import type { Schema, Struct } from '@strapi/strapi';

export interface ComponentsAccordionSections extends Struct.ComponentSchema {
  collectionName: 'components_components_accordion_sections';
  info: {
    description: 'Accordion with expandable sections';
    displayName: 'Rozj\u00ED\u017Ed\u011Bc\u00ED sekce';
  };
  attributes: {
    sections: Schema.Attribute.Component<'elements.expandable-section', true>;
  };
}

export interface ComponentsAlert extends Struct.ComponentSchema {
  collectionName: 'components_components_alerts';
  info: {
    description: 'Alert message with type variants';
    displayName: 'Upozorn\u011Bn\u00ED';
  };
  attributes: {
    text: Schema.Attribute.RichText;
    title: Schema.Attribute.String;
    type: Schema.Attribute.Enumeration<
      ['info', 'success', 'warning', 'error']
    > &
      Schema.Attribute.DefaultTo<'info'>;
  };
}

export interface ComponentsBadges extends Struct.ComponentSchema {
  collectionName: 'components_components_badges';
  info: {
    description: 'Group of badge labels';
    displayName: 'Badges';
  };
  attributes: {
    alignment: Schema.Attribute.Enumeration<['L', 'C', 'R']> &
      Schema.Attribute.DefaultTo<'L'>;
    badges: Schema.Attribute.Component<'elements.badge', true>;
  };
}

export interface ComponentsBannerCards extends Struct.ComponentSchema {
  collectionName: 'components_components_banner_cards';
  info: {
    description: 'Full-width stacked banner cards';
    displayName: 'Banner karty';
  };
  attributes: {
    cards: Schema.Attribute.Component<'elements.banner-card', true>;
  };
}

export interface ComponentsButtonGroup extends Struct.ComponentSchema {
  collectionName: 'components_components_button_groups';
  info: {
    description: 'Group of buttons with alignment';
    displayName: 'Tla\u010D\u00EDtka';
  };
  attributes: {
    alignment: Schema.Attribute.Enumeration<['L', 'C', 'R']> &
      Schema.Attribute.DefaultTo<'L'>;
    buttons: Schema.Attribute.Component<'elements.button', true>;
  };
}

export interface ComponentsContactCards extends Struct.ComponentSchema {
  collectionName: 'components_components_contact_cards';
  info: {
    description: 'Grid of contact person cards';
    displayName: 'Kontakty';
  };
  attributes: {
    cards: Schema.Attribute.Component<'elements.contact-card-person', true>;
  };
}

export interface ComponentsDocuments extends Struct.ComponentSchema {
  collectionName: 'components_components_documents';
  info: {
    description: 'Document download grid';
    displayName: 'Dokumenty';
  };
  attributes: {
    columns: Schema.Attribute.Enumeration<['1', '2', '3']> &
      Schema.Attribute.DefaultTo<'3'>;
    documents: Schema.Attribute.Component<'elements.document-item', true>;
  };
}

export interface ComponentsFeatureCards extends Struct.ComponentSchema {
  collectionName: 'components_components_feature_cards';
  info: {
    description: 'Grid of feature cards';
    displayName: 'Karty';
  };
  attributes: {
    card_clickable: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    cards: Schema.Attribute.Component<'elements.feature-card', true>;
    columns: Schema.Attribute.Enumeration<['2', '3', '4']> &
      Schema.Attribute.DefaultTo<'3'>;
  };
}

export interface ComponentsGallerySlider extends Struct.ComponentSchema {
  collectionName: 'components_components_gallery_sliders';
  info: {
    description: 'Horizontal photo strip slider';
    displayName: 'P\u00E1s galerie';
  };
  attributes: {
    photos: Schema.Attribute.Component<'elements.photo', true>;
  };
}

export interface ComponentsHeading extends Struct.ComponentSchema {
  collectionName: 'components_components_headings';
  info: {
    description: 'Heading with configurable level and anchor';
    displayName: 'Nadpis';
  };
  attributes: {
    anchor: Schema.Attribute.String;
    text: Schema.Attribute.String;
    type: Schema.Attribute.Enumeration<['h2', 'h3', 'h4', 'h5', 'h6']> &
      Schema.Attribute.DefaultTo<'h2'>;
  };
}

export interface ComponentsImage extends Struct.ComponentSchema {
  collectionName: 'components_components_images';
  info: {
    description: 'Single image display';
    displayName: 'Obr\u00E1zek';
  };
  attributes: {
    image: Schema.Attribute.Media<'images'>;
  };
}

export interface ComponentsLinksList extends Struct.ComponentSchema {
  collectionName: 'components_components_links_lists';
  info: {
    description: 'List of text links in grid or rows layout';
    displayName: 'Seznam odkaz\u016F';
  };
  attributes: {
    layout: Schema.Attribute.Enumeration<['Grid', 'Rows']> &
      Schema.Attribute.DefaultTo<'Rows'>;
    links: Schema.Attribute.Component<'elements.text-link', true>;
  };
}

export interface ComponentsNewsArticles extends Struct.ComponentSchema {
  collectionName: 'components_components_news_articles';
  info: {
    description: 'News articles block with category filter';
    displayName: 'Aktuality';
  };
  attributes: {
    categories: Schema.Attribute.Relation<
      'oneToMany',
      'api::category.category'
    >;
    limit: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 20;
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<6>;
    show_all_link: Schema.Attribute.Component<'elements.text-link', false>;
  };
}

export interface ComponentsPartnerLogos extends Struct.ComponentSchema {
  collectionName: 'components_components_partner_logos';
  info: {
    description: 'Partner logo grid';
    displayName: 'Loga partner\u016F';
  };
  attributes: {
    columns: Schema.Attribute.Enumeration<['2', '3', '4', '5', '6']> &
      Schema.Attribute.DefaultTo<'4'>;
    grayscale: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    partners: Schema.Attribute.Component<'elements.partner-logo', true>;
  };
}

export interface ComponentsPhotoGallery extends Struct.ComponentSchema {
  collectionName: 'components_components_photo_galleries';
  info: {
    description: 'Photo gallery grid';
    displayName: 'Fotogalerie';
  };
  attributes: {
    columns: Schema.Attribute.Enumeration<['2', '3', '4']> &
      Schema.Attribute.DefaultTo<'3'>;
    photos: Schema.Attribute.Component<'elements.photo', true>;
  };
}

export interface ComponentsPopup extends Struct.ComponentSchema {
  collectionName: 'components_components_popups';
  info: {
    description: 'Modal popup with dismissal memory';
    displayName: 'Popup';
  };
  attributes: {
    description: Schema.Attribute.RichText;
    link: Schema.Attribute.Component<'elements.text-link', false>;
    rememberDismissal: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    title: Schema.Attribute.String;
  };
}

export interface ComponentsSectionDivider extends Struct.ComponentSchema {
  collectionName: 'components_components_section_dividers';
  info: {
    description: 'Horizontal divider with spacing and style';
    displayName: 'Rozd\u011Blovn\u00EDk';
  };
  attributes: {
    spacing: Schema.Attribute.Enumeration<['S', 'M', 'L']> &
      Schema.Attribute.DefaultTo<'M'>;
    style: Schema.Attribute.Enumeration<['solid', 'dashed', 'dotted']> &
      Schema.Attribute.DefaultTo<'solid'>;
  };
}

export interface ComponentsSlider extends Struct.ComponentSchema {
  collectionName: 'components_components_sliders';
  info: {
    description: 'Content slider with slides';
    displayName: 'Slider';
  };
  attributes: {
    autoplay: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    autoplay_interval: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<5000>;
    slides: Schema.Attribute.Component<'elements.slide', true>;
  };
}

export interface ComponentsStatsHighlights extends Struct.ComponentSchema {
  collectionName: 'components_components_stats_highlights';
  info: {
    description: 'Stats highlight blocks';
    displayName: 'Statistiky';
  };
  attributes: {
    columns: Schema.Attribute.Enumeration<['2', '3', '4']> &
      Schema.Attribute.DefaultTo<'4'>;
    items: Schema.Attribute.Component<'elements.stat-item', true>;
  };
}

export interface ComponentsText extends Struct.ComponentSchema {
  collectionName: 'components_components_texts';
  info: {
    description: 'Rich text content block';
    displayName: 'Textov\u00E9 pole';
  };
  attributes: {
    text: Schema.Attribute.RichText;
  };
}

export interface ComponentsTimeline extends Struct.ComponentSchema {
  collectionName: 'components_components_timelines';
  info: {
    description: 'Numbered timeline steps';
    displayName: '\u010Casov\u00E1 osa';
  };
  attributes: {
    items: Schema.Attribute.Component<'elements.timeline-item', true>;
  };
}

export interface ComponentsVideo extends Struct.ComponentSchema {
  collectionName: 'components_components_videos';
  info: {
    description: 'YouTube video embed';
    displayName: 'Video';
  };
  attributes: {
    aspect_ratio: Schema.Attribute.Enumeration<['16:9', '4:3', '1:1']> &
      Schema.Attribute.DefaultTo<'16:9'>;
    youtube_id: Schema.Attribute.String;
  };
}

export interface ElementsBadge extends Struct.ComponentSchema {
  collectionName: 'components_elements_badges';
  info: {
    description: 'Colored label badge';
    displayName: 'Badge';
  };
  attributes: {
    label: Schema.Attribute.String & Schema.Attribute.Required;
    size: Schema.Attribute.Enumeration<['S', 'M', 'L']> &
      Schema.Attribute.DefaultTo<'M'>;
    variant: Schema.Attribute.Enumeration<
      ['default', 'primary', 'accent', 'success', 'warning', 'error']
    > &
      Schema.Attribute.DefaultTo<'default'>;
  };
}

export interface ElementsBannerCard extends Struct.ComponentSchema {
  collectionName: 'components_elements_banner_cards';
  info: {
    description: 'Banner card with title, description and link';
    displayName: 'Banner karta';
  };
  attributes: {
    description: Schema.Attribute.Text;
    link: Schema.Attribute.Component<'elements.text-link', false>;
    title: Schema.Attribute.String;
  };
}

export interface ElementsButton extends Struct.ComponentSchema {
  collectionName: 'components_elements_buttons';
  info: {
    description: 'Button with link and style variants';
    displayName: 'Tla\u010D\u00EDtko';
  };
  attributes: {
    link: Schema.Attribute.Component<'elements.text-link', false>;
    size: Schema.Attribute.Enumeration<['S', 'M', 'L']> &
      Schema.Attribute.DefaultTo<'M'>;
    variant: Schema.Attribute.Enumeration<
      ['Primary', 'Secondary', 'Outline', 'Ghost']
    > &
      Schema.Attribute.DefaultTo<'Primary'>;
  };
}

export interface ElementsContactCardPerson extends Struct.ComponentSchema {
  collectionName: 'components_elements_contact_card_people';
  info: {
    description: 'Contact card for a person';
    displayName: 'Kontaktn\u00ED osoba';
  };
  attributes: {
    email: Schema.Attribute.String;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    phone: Schema.Attribute.String;
    photo: Schema.Attribute.Media<'images'>;
    role: Schema.Attribute.String;
  };
}

export interface ElementsDocumentItem extends Struct.ComponentSchema {
  collectionName: 'components_elements_document_items';
  info: {
    description: 'Document with name and file';
    displayName: 'Dokument';
  };
  attributes: {
    file: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    name: Schema.Attribute.String;
  };
}

export interface ElementsExpandableSection extends Struct.ComponentSchema {
  collectionName: 'components_elements_expandable_sections';
  info: {
    description: 'Expandable section with content and attachments';
    displayName: 'Rozbalovac\u00ED sekce';
  };
  attributes: {
    default_open: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    description: Schema.Attribute.RichText;
    files: Schema.Attribute.Component<'elements.document-item', true>;
    photos: Schema.Attribute.Component<'elements.photo', true>;
    title: Schema.Attribute.String;
  };
}

export interface ElementsFeatureCard extends Struct.ComponentSchema {
  collectionName: 'components_elements_feature_cards';
  info: {
    description: 'Feature card with title, description and link';
    displayName: 'Karta';
  };
  attributes: {
    description: Schema.Attribute.Text;
    icon: Schema.Attribute.Media<'images'>;
    link: Schema.Attribute.Component<'elements.text-link', false>;
    title: Schema.Attribute.String;
  };
}

export interface ElementsLink extends Struct.ComponentSchema {
  collectionName: 'components_elements_links';
  info: {
    description: 'Link to a page, URL, or file';
    displayName: 'Odkaz';
  };
  attributes: {
    anchor: Schema.Attribute.String;
    file: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    page: Schema.Attribute.Relation<'oneToOne', 'api::page.page'>;
    url: Schema.Attribute.String;
  };
}

export interface ElementsPartnerLogo extends Struct.ComponentSchema {
  collectionName: 'components_elements_partner_logos';
  info: {
    description: 'Partner logo with name and URL';
    displayName: 'Logo partnera';
  };
  attributes: {
    logo: Schema.Attribute.Media<'images'>;
    name: Schema.Attribute.String;
    url: Schema.Attribute.String;
  };
}

export interface ElementsPhoto extends Struct.ComponentSchema {
  collectionName: 'components_elements_photos';
  info: {
    description: 'Single photo';
    displayName: 'Fotka';
  };
  attributes: {
    image: Schema.Attribute.Media<'images'>;
  };
}

export interface ElementsSlide extends Struct.ComponentSchema {
  collectionName: 'components_elements_slides';
  info: {
    description: 'Slide with title, description, link and images';
    displayName: 'Slide';
  };
  attributes: {
    background_image: Schema.Attribute.Media<'images'>;
    description: Schema.Attribute.RichText;
    image: Schema.Attribute.Media<'images'>;
    link: Schema.Attribute.Component<'elements.text-link', false>;
    title: Schema.Attribute.String;
  };
}

export interface ElementsStatItem extends Struct.ComponentSchema {
  collectionName: 'components_elements_stat_items';
  info: {
    description: 'Stat highlight item';
    displayName: 'Statistick\u00E1 polo\u017Eka';
  };
  attributes: {
    description: Schema.Attribute.Text;
    number: Schema.Attribute.String;
    title: Schema.Attribute.String;
  };
}

export interface ElementsStatValue extends Struct.ComponentSchema {
  collectionName: 'components_elements_stat_values';
  info: {
    description: 'Numeric stat with label';
    displayName: 'Stat Value';
  };
  attributes: {
    label: Schema.Attribute.String & Schema.Attribute.Required;
    value: Schema.Attribute.Integer & Schema.Attribute.Required;
  };
}

export interface ElementsTextLink extends Struct.ComponentSchema {
  collectionName: 'components_elements_text_links';
  info: {
    description: 'Text link with label';
    displayName: 'Textov\u00FD odkaz';
  };
  attributes: {
    anchor: Schema.Attribute.String;
    disabled: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    file: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    page: Schema.Attribute.Relation<'oneToOne', 'api::page.page'>;
    text: Schema.Attribute.String;
    url: Schema.Attribute.String;
  };
}

export interface ElementsTimelineItem extends Struct.ComponentSchema {
  collectionName: 'components_elements_timeline_items';
  info: {
    description: 'Timeline step or milestone';
    displayName: 'Polo\u017Eka \u010Dasov\u00E9 osy';
  };
  attributes: {
    description: Schema.Attribute.Text;
    number: Schema.Attribute.String;
    title: Schema.Attribute.String;
  };
}

export interface FooterLinkSection extends Struct.ComponentSchema {
  collectionName: 'components_footer_link_sections';
  info: {
    description: 'Footer link section with title and links';
    displayName: 'Sekce odkaz\u016F';
  };
  attributes: {
    links: Schema.Attribute.Component<'elements.text-link', true> &
      Schema.Attribute.Required;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

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
      'components.accordion-sections': ComponentsAccordionSections;
      'components.alert': ComponentsAlert;
      'components.badges': ComponentsBadges;
      'components.banner-cards': ComponentsBannerCards;
      'components.button-group': ComponentsButtonGroup;
      'components.contact-cards': ComponentsContactCards;
      'components.documents': ComponentsDocuments;
      'components.feature-cards': ComponentsFeatureCards;
      'components.gallery-slider': ComponentsGallerySlider;
      'components.heading': ComponentsHeading;
      'components.image': ComponentsImage;
      'components.links-list': ComponentsLinksList;
      'components.news-articles': ComponentsNewsArticles;
      'components.partner-logos': ComponentsPartnerLogos;
      'components.photo-gallery': ComponentsPhotoGallery;
      'components.popup': ComponentsPopup;
      'components.section-divider': ComponentsSectionDivider;
      'components.slider': ComponentsSlider;
      'components.stats-highlights': ComponentsStatsHighlights;
      'components.text': ComponentsText;
      'components.timeline': ComponentsTimeline;
      'components.video': ComponentsVideo;
      'elements.badge': ElementsBadge;
      'elements.banner-card': ElementsBannerCard;
      'elements.button': ElementsButton;
      'elements.contact-card-person': ElementsContactCardPerson;
      'elements.document-item': ElementsDocumentItem;
      'elements.expandable-section': ElementsExpandableSection;
      'elements.feature-card': ElementsFeatureCard;
      'elements.link': ElementsLink;
      'elements.partner-logo': ElementsPartnerLogo;
      'elements.photo': ElementsPhoto;
      'elements.slide': ElementsSlide;
      'elements.stat-item': ElementsStatItem;
      'elements.stat-value': ElementsStatValue;
      'elements.text-link': ElementsTextLink;
      'elements.timeline-item': ElementsTimelineItem;
      'footer.link-section': FooterLinkSection;
      'tournament.player': TournamentPlayer;
    }
  }
}
