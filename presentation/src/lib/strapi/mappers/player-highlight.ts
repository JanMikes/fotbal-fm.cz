import type { PlayerHighlight, StatValue } from '@/lib/types';
import type { StrapiRawPlayerHighlight, StrapiRawStatValue } from '../types';
import { mapMedia } from './shared';

function mapStatValue(raw: StrapiRawStatValue): StatValue {
  return {
    value: raw.value,
    label: raw.label,
  };
}

export function mapPlayerHighlight(raw: StrapiRawPlayerHighlight): PlayerHighlight {
  const fullName = raw.player?.name ?? '';
  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts.slice(0, -1).join(' ') || fullName;
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

  return {
    documentId: raw.documentId,
    title: raw.title,
    playerName: fullName,
    playerFirstName: firstName,
    playerLastName: lastName,
    playerPhoto: raw.player ? mapMedia(raw.player.photo) : null,
    highlightStat: mapStatValue(raw.highlightStat),
    stats: (raw.stats ?? []).map(mapStatValue),
    sortOrder: raw.sortOrder ?? 0,
  };
}
