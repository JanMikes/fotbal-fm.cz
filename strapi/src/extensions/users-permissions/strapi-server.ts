import { errors } from '@strapi/utils';

const { ForbiddenError } = errors;

/**
 * Hardening of the users-permissions content API.
 *
 * The stock plugin has no ownership check: with `user.find` / `user.update` enabled for the
 * Authenticated role (the backoffice needs them so populated author/modifiedBy relations
 * are not stripped by the sanitizer), every signed-in app user could list all accounts or
 * PUT arbitrary fields — including `role` and `audienceCategories` — on any user.
 *
 * Rules enforced here, for callers authenticated with a user JWT:
 *   - find      → always narrowed to the caller (no user directory)
 *   - findOne   → own profile only
 *   - update    → own profile only, and only the plain profile fields
 *   - create / destroy → never
 * Requests authenticated with an API token (the web, backoffice and API service token)
 * keep the stock behaviour — that is how the API assigns audience categories.
 */

const SELF_EDITABLE_FIELDS = new Set(['firstname', 'lastname', 'jobTitle']);

type Ctx = {
  state?: { auth?: { strategy?: { name?: string } }; user?: { id?: number | string } };
  params: { id?: string | number };
  query: Record<string, unknown>;
  request: { body?: Record<string, unknown> };
  unauthorized: () => unknown;
};

function isApiTokenRequest(ctx: Ctx): boolean {
  return ctx.state?.auth?.strategy?.name === 'api-token';
}

function currentUserId(ctx: Ctx): number | null {
  const id = ctx.state?.user?.id;
  return id === undefined || id === null ? null : Number(id);
}

function isSelf(ctx: Ctx, id: string | number | undefined): boolean {
  const me = currentUserId(ctx);
  return me !== null && id !== undefined && me === Number(id);
}

export default (plugin) => {
  const controllers = plugin.controllers.user;
  const { find, findOne, update, create, destroy } = controllers;

  controllers.find = async (ctx: Ctx) => {
    if (isApiTokenRequest(ctx)) return find(ctx);

    const me = currentUserId(ctx);
    if (me === null) return ctx.unauthorized();

    // Whatever filter a member sends, the listing collapses to their own record.
    ctx.query = { ...ctx.query, filters: { id: { $eq: me } } };
    return find(ctx);
  };

  controllers.findOne = async (ctx: Ctx) => {
    if (isApiTokenRequest(ctx) || isSelf(ctx, ctx.params.id)) return findOne(ctx);
    throw new ForbiddenError('Cizí profil není dostupný.');
  };

  controllers.update = async (ctx: Ctx) => {
    if (isApiTokenRequest(ctx)) return update(ctx);
    if (!isSelf(ctx, ctx.params.id)) {
      throw new ForbiddenError('Lze upravit pouze vlastní profil.');
    }

    const disallowed = Object.keys(ctx.request.body ?? {}).filter((key) => !SELF_EDITABLE_FIELDS.has(key));
    if (disallowed.length > 0) {
      throw new ForbiddenError(`Tato pole nelze měnit přes profil: ${disallowed.join(', ')}.`);
    }
    return update(ctx);
  };

  controllers.create = async (ctx: Ctx) => {
    if (isApiTokenRequest(ctx)) return create(ctx);
    throw new ForbiddenError('Uživatele může zakládat pouze registrace.');
  };

  controllers.destroy = async (ctx: Ctx) => {
    if (isApiTokenRequest(ctx)) return destroy(ctx);
    throw new ForbiddenError('Účet lze zrušit pouze přes aplikaci.');
  };

  return plugin;
};
