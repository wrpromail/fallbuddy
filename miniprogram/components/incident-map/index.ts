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
      const open = !this.data.open;
      const hasPosteriorPart = this.data.parts.some((part: string) => part === 'tailbone' || part === 'back');
      this.setData({ open, view: open && hasPosteriorPart ? 'back' : this.data.view });
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
