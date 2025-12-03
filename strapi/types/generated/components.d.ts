import type { Schema, Struct } from '@strapi/strapi';

export interface TournamentPlayer extends Struct.ComponentSchema {
  collectionName: 'components_tournament_players';
  info: {
    description: 'Tournament player recognition';
    displayName: 'Player';
  };
  attributes: {
    playerName: Schema.Attribute.String & Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'tournament.player': TournamentPlayer;
    }
  }
}
