function buildDisplayName(data: { name?: string; number?: number | null }): string | undefined {
  if (!data.name) return undefined;
  return data.number ? `${data.name} (#${data.number})` : data.name;
}

export default {
  beforeCreate(event) {
    const displayName = buildDisplayName(event.params.data);
    if (displayName) {
      event.params.data.displayName = displayName;
    }
  },

  beforeUpdate(event) {
    const { data } = event.params;

    // If name or number is being updated, recalculate displayName
    if (data.name !== undefined || data.number !== undefined) {
      // We need both fields - fetch current values for any that aren't being updated
      const needsFetch = data.name === undefined || data.number === undefined;
      if (!needsFetch) {
        const displayName = buildDisplayName(data);
        if (displayName) {
          data.displayName = displayName;
        }
      }
    }
  },

  async afterUpdate(event) {
    const { result } = event;
    const expected = buildDisplayName({ name: result.name, number: result.number });
    if (expected && result.displayName !== expected) {
      await strapi.db.query('api::player.player').update({
        where: { id: result.id },
        data: { displayName: expected },
      });
    }
  },
};
