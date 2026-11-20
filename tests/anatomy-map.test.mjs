import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let component;
globalThis.Component = (definition) => { component = definition; };
try {
  require('../build/test/miniprogram/components/skeleton-map/index.js');
} finally {
  delete globalThis.Component;
}

test('人体图使用患者左右，正背面切换时屏幕侧别反向，骨骼和肌肉层共用热点', async () => {
  for (const [view, leftSign] of [['front', 1], ['back', -1]]) {
    for (const appearanceMode of ['q', 'bones', 'muscles']) {
      const emitted = [];
      const instance = {
        data: { view, appearanceMode, selectedParts: ['knee_r'], selectionOnly: false, hotspots: [] },
        setData(patch) { Object.assign(this.data, patch); },
        triggerEvent(name, detail) { emitted.push([name, detail.id]); },
      };
      component.methods.build.call(instance);
      for (const id of ['knee', 'shoulder', 'wrist', 'ankle']) {
        const left = instance.data.spots.find((part) => part.id === id + '_l');
        const right = instance.data.spots.find((part) => part.id === id + '_r');
        assert.equal(Math.sign(left.left - right.left), leftSign, [view, appearanceMode, id].join('/'));
        assert.ok(Math.abs(left.left + right.left - 100) < 0.4);
      }
      component.methods.onTap.call(instance, { currentTarget: { dataset: { id: 'knee_r', label: '右膝' } } });
      assert.deepEqual(emitted, [['hotspot', 'knee_r']]);
      instance.data.selectionOnly = true;
      component.methods.build.call(instance);
      assert.deepEqual(instance.data.spots.map(({ id, selected }) => ({ id, selected })), [
        { id: 'knee_r', selected: true },
      ]);
      if (appearanceMode === 'q') {
        assert.equal(instance.data.plate, '');
        continue;
      }
      const png = await readFile(new URL(`../miniprogram${instance.data.plate}`, import.meta.url));
      assert.equal(png.readUInt32BE(16), 600);
      assert.equal(png.readUInt32BE(20), 900);
    }
  }
});
