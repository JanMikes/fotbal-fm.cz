export default {
  async beforeCreate(event: { params: { data: Record<string, unknown> } }) {
    const { data } = event.params;
    const ctx = strapi.requestContext.get();
    if (ctx?.state?.user?.id) {
      data.updatedBy = ctx.state.user.id;
    }
  },
  async beforeUpdate(event: { params: { data: Record<string, unknown> } }) {
    const { data } = event.params;
    const ctx = strapi.requestContext.get();
    if (ctx?.state?.user?.id) {
      data.updatedBy = ctx.state.user.id;
    }
  },
};
