import type { Verdict } from '../core/types';
import type { ClipKey } from './clips';

export function clipForVerdict(v: Verdict): ClipKey {
  const has = (r: Verdict['reasons'][number]) => v.reasons.includes(r);
  if (v.level === 'red') {
    if (has('batch_on_alert') || has('on_alert')) return 'v_red_alert';
    if (has('pack_expired')) return 'v_red_expired';
    return 'v_red_notfound';
  }
  if (v.level === 'amber') {
    if (has('name_mismatch') || has('strength_mismatch')) return 'v_amber_mismatch';
    if (has('alert_product')) return 'v_amber_alert';
    if (has('community_flag')) return 'v_amber_community';
    return 'v_amber_lapsed';
  }
  if (v.level === 'green') return has('name_unconfirmed') ? 'v_green_unconfirmed' : 'v_green';
  return 'v_unknown';
}
