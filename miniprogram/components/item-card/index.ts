import type { InventoryView } from '../../shared/types';

Component({
  options: { addGlobalClass: true },
  properties: {
    item: { type: Object, value: null },
    selected: { type: Boolean, value: false },
    disabled: { type: Boolean, value: false },
  },
  data: {
    iconPath: '',
  },
  observers: {
    item(item: InventoryView | null) {
      this.setData({ iconPath: item && item.category !== 'cosmetic' ? item.icon : '' });
    },
  },
  methods: {
    onTap() {
      if (this.data.disabled) return;
      const item = this.data.item as InventoryView | null;
      if (!item) return;
      this.triggerEvent('select', { itemDefId: item.itemDefId });
    },
  },
});
