import type { DynamicZoneComponent } from '@/lib/types';
import { ComponentError } from './ComponentError';
import { RichText } from '../dynamic/RichText';
import { Heading } from '../dynamic/Heading';
import { Alert } from '../dynamic/Alert';
import { LinksList } from '../dynamic/LinksList';
import { Video } from '../dynamic/Video';
import { FeatureCards } from '../dynamic/FeatureCards';
import { BannerCards } from '../dynamic/BannerCards';
import { Documents } from '../dynamic/Documents';
import { PartnerLogos } from '../dynamic/PartnerLogos';
import { StatsHighlights } from '../dynamic/StatsHighlights';
import { Timeline } from '../dynamic/Timeline';
import { SectionDivider } from '../dynamic/SectionDivider';
import { Slider } from '../dynamic/Slider';
import { GallerySlider } from '../dynamic/GallerySlider';
import { PhotoGallery } from '../dynamic/PhotoGallery';
import { ButtonGroup } from '../dynamic/ButtonGroup';
import { ContactCards } from '../dynamic/ContactCards';
import { AccordionSections } from '../dynamic/AccordionSections';
import { Popup } from '../dynamic/Popup';
import { Badges } from '../dynamic/Badges';
import { ImageBlock } from '../dynamic/ImageBlock';
import { NewsArticles } from '../dynamic/NewsArticles';

interface DynamicZoneProps {
  components: DynamicZoneComponent[];
  sidebar?: boolean;
}

export function DynamicZone({ components, sidebar }: DynamicZoneProps) {
  if (!components || components.length === 0) return null;

  return (
    <>
      {components.map((component, index) => (
        <DynamicZoneItem key={`${component.__component}-${component.id}-${index}`} component={component} sidebar={sidebar} />
      ))}
    </>
  );
}

function DynamicZoneItem({ component, sidebar }: { component: DynamicZoneComponent; sidebar?: boolean }) {
  switch (component.__component) {
    case 'components.text':
      return <RichText data={component} />;
    case 'components.heading':
      return <Heading data={component} />;
    case 'components.alert':
      return <Alert data={component} />;
    case 'components.links-list':
      return <LinksList data={component} />;
    case 'components.video':
      return <Video data={component} />;
    case 'components.feature-cards':
      return <FeatureCards data={component} />;
    case 'components.banner-cards':
      return <BannerCards data={component} />;
    case 'components.documents':
      return <Documents data={component} />;
    case 'components.partner-logos':
      return <PartnerLogos data={component} />;
    case 'components.stats-highlights':
      return <StatsHighlights data={component} />;
    case 'components.timeline':
      return <Timeline data={component} />;
    case 'components.section-divider':
      return <SectionDivider data={component} />;
    case 'components.slider':
      return <Slider data={component} />;
    case 'components.gallery-slider':
      return <GallerySlider data={component} />;
    case 'components.photo-gallery':
      return <PhotoGallery data={component} />;
    case 'components.button-group':
      return <ButtonGroup data={component} />;
    case 'components.contact-cards':
      return <ContactCards data={component} />;
    case 'components.accordion-sections':
      return <AccordionSections data={component} />;
    case 'components.popup':
      return <Popup data={component} />;
    case 'components.badges':
      return <Badges data={component} />;
    case 'components.image':
      return <ImageBlock data={component} />;
    case 'components.news-articles':
      return <NewsArticles data={component} sidebar={sidebar} />;
    default:
      return <ComponentError componentType={(component as DynamicZoneComponent).__component} />;
  }
}
