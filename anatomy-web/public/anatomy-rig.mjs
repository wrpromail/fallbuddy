// anatomy-rig.mjs —— 运动层 · 关节树 + 动作引擎
// 骨骼与肌肉按关节分组嵌套（画法层负责），本模块只负责“给每个关节算角度”。
// 关节几何（pivot / 缩放锚点）与动作角度表由各风格画法模块提供：
//   new Rig(svg, { joints, actions, reduced })
// 关节 id 两套风格保持一致，动作/待机逻辑因此完全共用。

const ANGLE_JOINT_IDS = [
  'root', 'torso', 'neck',
  'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'wristL', 'wristR',
  'hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR',
];
const POSE_IDS = [...ANGLE_JOINT_IDS, 'rootX', 'rootY'];

/** 程序化待机姿势：呼吸 + 重心晃动（reduced 时幅度降到 25%） */
function idlePose(t, amp = 1) {
  return {
    rootX: 3 * Math.sin(t * 0.9) * amp,
    torso: 2.2 * Math.sin(t * 0.7) * amp,
    neck: -1.5 * Math.sin(t * 0.7 + 0.6) * amp,
    shoulderL: 1.6 * Math.sin(t * 0.8 + 1) * amp,
    shoulderR: -1.6 * Math.sin(t * 0.8 + 1) * amp,
    hipL: 1.2 * Math.sin(t * 0.7 + 2) * amp,
    hipR: -1.2 * Math.sin(t * 0.7 + 2) * amp,
    kneeL: -0.8 * Math.sin(t * 0.7 + 2.4) * amp,
    kneeR: 0.8 * Math.sin(t * 0.7 + 2.4) * amp,
    breath: 1 + 0.016 * Math.sin(t * 1.7) * amp,
  };
}

/** 关键帧补齐：未写的关节按 0 处理，保证动作结束时归位 */
function compile(frames, duration) {
  return frames.map((fr) => {
    const pose = Object.fromEntries(POSE_IDS.map((j) => [j, fr.pose[j] ?? 0]));
    return { time: fr.t * duration, pose };
  });
}

const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

function sampleAction(compiled, elapsed) {
  const pose = Object.fromEntries(POSE_IDS.map((j) => [j, 0]));
  let i = 0;
  while (i < compiled.length - 1 && compiled[i + 1].time <= elapsed) i++;
  const a = compiled[i], b = compiled[Math.min(i + 1, compiled.length - 1)];
  const span = Math.max(1e-6, b.time - a.time);
  const k = easeInOut(Math.min(1, Math.max(0, (elapsed - a.time) / span)));
  for (const j of POSE_IDS) pose[j] = a.pose[j] + (b.pose[j] - a.pose[j]) * k;
  return pose;
}

export class Rig {
  /**
   * @param {SVGSVGElement} svg
   * @param {{ joints: object, actions?: object, reduced?: boolean }} opts
   */
  constructor(svg, opts = {}) {
    this.svg = svg;
    this.jointDefs = opts.joints ?? {};
    this.actions = opts.actions ?? {};
    this.reduced = !!opts.reduced;
    this.groups = {};
    for (const id of Object.keys(this.jointDefs)) {
      this.groups[id] = svg.querySelector(`#j\\:${id}`);
    }
    this.action = null;
    this.t = 0;
    this.last = performance.now();
    this.raf = null;
    this.onActionEnd = null;
    this.frame = this.frame.bind(this);
    this.raf = requestAnimationFrame(this.frame);
  }

  /** 播放一个动作；不传 id 则回到待机 */
  play(id) {
    const def = id && this.actions[id];
    if (!def) {
      this.action = null;
      return;
    }
    this.action = {
      name: id,
      def,
      compiled: compile(def.frames, def.duration),
      startedAt: this.t,
      loopLeft: def.loops ?? 1,
    };
  }

  get playing() {
    return this.action != null;
  }

  frame(now) {
    const dt = Math.min(64, now - this.last);
    this.last = now;
    this.t += dt;
    this.apply();
    this.raf = requestAnimationFrame(this.frame);
  }

  computePose() {
    const amp = this.reduced ? 0.25 : 1;
    const base = idlePose(this.t / 1000, amp);
    if (!this.action) return base;

    const { def, compiled, startedAt, loopLeft } = this.action;
    const elapsed = this.t - startedAt;
    const total = def.duration;
    if (elapsed >= total) {
      if (loopLeft <= 1) {
        this.action = null;
        this.onActionEnd?.(def);
        return base;
      }
      this.action.loopLeft = loopLeft - 1;
      this.action.startedAt = this.t - (elapsed - total);
      return this.computePose();
    }
    const pose = sampleAction(compiled, elapsed);
    // 动作期间保留轻微呼吸，其余待机晃动清零
    return { ...pose, breath: 1 + 0.014 * Math.sin((this.t / 1000) * 1.7) * amp };
  }

  apply() {
    const pose = this.computePose();
    for (const [id, cfg] of Object.entries(this.jointDefs)) {
      const g = this.groups[id];
      if (!g) continue;
      if (id === 'breath') {
        const s = pose.breath ?? 1;
        const [cx, cy] = cfg.scaleAround;
        g.setAttribute('transform', `translate(${cx} ${cy}) scale(${s.toFixed(4)}) translate(${-cx} ${-cy})`);
        continue;
      }
      if (id === 'root') {
        const rot = pose.root ?? 0;
        const tx = pose.rootX ?? 0;
        const ty = pose.rootY ?? 0;
        const [px, py] = cfg.pivot;
        const tf = [
          ty || tx ? `translate(${tx.toFixed(2)} ${ty.toFixed(2)})` : '',
          rot ? `rotate(${rot.toFixed(2)} ${px} ${py})` : '',
        ].filter(Boolean).join(' ');
        g.setAttribute('transform', tf);
        continue;
      }
      const a = pose[id] ?? 0;
      if (a) {
        const [px, py] = cfg.pivot;
        g.setAttribute('transform', `rotate(${a.toFixed(2)} ${px} ${py})`);
      } else {
        g.removeAttribute('transform');
      }
    }
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
  }
}
