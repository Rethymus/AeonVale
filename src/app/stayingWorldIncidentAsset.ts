import type { ContentRegistry } from '@content/defs';
import type { StayingWorldIncidentDef } from '@sim';
import { itemIconAssetId } from './itemIcons';
import { locationPreviewAssetId } from './locationPreview';

export function stayingWorldIncidentAssetId(incident: StayingWorldIncidentDef, content?: ContentRegistry): string | undefined {
  switch (incident.id) {
    case 'incident.beast-trace':
      return locationPreviewAssetId('spirit-vein') ?? itemIconAssetId(incident.itemId, content);
    case 'incident.array-fray':
      return locationPreviewAssetId('ruin-gate') ?? itemIconAssetId(incident.itemId, content);
    case 'incident.herb-relief':
      return locationPreviewAssetId('creek-field') ?? itemIconAssetId(incident.itemId, content);
    default:
      return locationPreviewAssetId('farmstead') ?? itemIconAssetId(incident.itemId, content);
  }
}
