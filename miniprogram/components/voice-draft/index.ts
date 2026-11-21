import { discardAudio, record, stopRecording, voiceCall } from '../../services/recording';
import { sensitiveWarning } from '../../shared/moderation';

type Draft = { title: string; body: string; text: string };
type Runtime = {
  _live: boolean;
  _file: string;
  _request: string;
  _player: WechatMiniprogram.InnerAudioContext | null;
  _listener: Parameters<typeof record>[0];
};

function register<D extends WechatMiniprogram.Component.DataOption, M extends WechatMiniprogram.Component.MethodOption>(
  options: WechatMiniprogram.Component.Options<D, {}, M, [], Runtime>,
) { Component(options); }

register({
  options: { addGlobalClass: true },
  data: {
    open: false, active: false, recording: false, busy: false, available: false, hasFile: false,
    title: '', body: '', transcript: '', notice: '', assisted: false,
  },
  lifetimes: {
    created() {
      this._live = true;
      this._file = '';
      this._request = '';
      this._player = null;
      this._listener = {
        stop: (file: string, duration: number, size: number) => {
          if (!this._live || !this.data.open || !this.data.active || duration < 15000 || duration > 90500 || size > 380000) {
            discardAudio(file);
            if (this._live) this.setData({ recording: false, notice: '请录制 15 至 90 秒' });
            return;
          }
          this._file = file;
          this.setData({ hasFile: true, recording: false, notice: '可以回听并整理成正文。' });
        },
        error: () => { if (this._live) this.setData({ recording: false, notice: '录音未开始，请检查麦克风授权或手动填写。' }); },
      };
    },
    detached() { this._live = false; this.release(); },
  },
  pageLifetimes: {
    hide() {
      if (this.data.recording) stopRecording(this._listener, true);
      this._player?.stop();
      this.setData({ active: false, recording: false });
    },
    show() { this.setData({ active: true }); },
  },
  methods: {
    async onOpen() {
      this.setData({ open: true, active: true });
      const res = await voiceCall<{ enabled: boolean }>('available');
      if (this._live) this.setData({ available: res.ok && res.data.enabled });
    },
    onRecord() {
      if (this.data.recording || this.data.busy || this.data.hasFile) return;
      this.setData({ notice: '', recording: true });
      wx.authorize({ scope: 'scope.record',
        success: () => {
          if (!this._live || !this.data.open || !this.data.active || !this.data.recording) return;
          if (!record(this._listener)) this.setData({ recording: false, notice: '麦克风正在使用，请稍后再试。' });
        },
        fail: () => { if (this._live) this.setData({ recording: false, notice: '未取得麦克风权限，可直接填写正文。' }); },
      });
    },
    onStop() { stopRecording(this._listener); },
    onPlay() {
      if (!this._file) return;
      this._player?.destroy();
      this._player = wx.createInnerAudioContext();
      this._player.src = this._file;
      this._player.play();
    },
    onTranscribe() {
      if (!this._file || this.data.busy || !this.data.available) return;
      wx.showModal({ title: '发送录音进行转写？', content: '录音将发送给配置的语音服务。如已启用文字整理，转写内容也会用于生成标题和正文摘录。结果由你确认。每天最多 3 次。',
        confirmText: '同意转写', success: ({ confirm }) => { if (confirm && this._live && this.data.open) void this.transcribe(); } });
    },
    async transcribe() {
      if (this.data.busy || !this._file) return;
      const requestId = 'voice_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      this._request = requestId;
      this.setData({ busy: true, notice: '' });
      try {
        const opened = await voiceCall<{ id: string }>('open', { requestId, consent: true });
        if (requestId !== this._request) return;
        if (!opened.ok) { this.setData({ notice: opened.message }); return; }
        const audio = await new Promise<string>((resolve, reject) => wx.getFileSystemManager().readFile({
          filePath: this._file, encoding: 'base64', success: ({ data }) => resolve(String(data)), fail: reject,
        }));
        if (requestId !== this._request) return;
        const res = await voiceCall<Draft>('run', { requestId, id: opened.data.id, audio });
        if (requestId !== this._request) return;
        if (!res.ok) { this.setData({ notice: res.message }); return; }
        this.setData({ title: res.data.title, body: res.data.body, transcript: res.data.text, assisted: true,
          notice: sensitiveWarning(res.data.text) || '请对照录音核对转写，再填入正文。' });
      } catch { if (requestId === this._request) this.setData({ notice: '录音读取失败，可继续手动填写。' }); }
      finally { if (requestId === this._request) { this._request = ''; this.setData({ busy: false }); } }
    },
    onText(event: WechatMiniprogram.Input) {
      this.setData({ body: event.detail.value, notice: sensitiveWarning(event.detail.value) });
    },
    onApply() {
      const body = this.data.body.trim();
      if (!body || this.data.busy) return;
      const warning = sensitiveWarning(body + ' ' + this.data.title);
      if (warning) { this.setData({ notice: warning }); return; }
      this.triggerEvent('applydraft', { body, title: this.data.title, assisted: this.data.assisted });
      this.onClose();
    },
    release() {
      if (this._request) void voiceCall('cancel', { requestId: this._request });
      this._request = '';
      stopRecording(this._listener, true);
      this._player?.destroy();
      this._player = null;
      discardAudio(this._file);
      this._file = '';
    },
    onClose() {
      this.setData({ open: false, active: false, recording: false, hasFile: false, busy: false, assisted: false,
        transcript: '', body: '', title: '', notice: '' });
      this.release();
    },
  },
});
