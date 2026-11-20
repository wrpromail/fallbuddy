Component({
  options: { addGlobalClass: true },
  properties: {
    parts: { type: Array, value: [] },
    selectable: { type: Boolean, value: false },
  },
  data: {
    open: false,
    view: 'front',
    mode: 'bones',
  },
  methods: {
    toggle() {
      this.setData({ open: !this.data.open });
    },
    switchView(event: WechatMiniprogram.TouchEvent) {
      this.setData({ view: event.currentTarget.dataset.view === 'back' ? 'back' : 'front' });
    },
    switchMode(event: WechatMiniprogram.TouchEvent) {
      this.setData({ mode: event.currentTarget.dataset.mode === 'muscles' ? 'muscles' : 'bones' });
    },
    selectPart(event: WechatMiniprogram.CustomEvent<{ id: string }>) {
      if (this.data.selectable) this.triggerEvent('selectpart', { id: event.detail.id });
    },
  },
});
