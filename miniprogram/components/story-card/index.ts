import { BODY_PART_LABEL, IMPACT_LABEL, SPORT_EMOJI } from '../../shared/enums';
import { relativeTime } from '../../shared/time';
import type { AtlasStoryCard } from '../../shared/types';

interface CardView {
  sportEmoji: string;
  impactLabel: string;
  timeText: string;
  parts: string[];
  anonymous: boolean;
  selfOnly: boolean;
  withdrawn: boolean;
}

Component({
  options: { addGlobalClass: true },
  properties: {
    story: { type: Object, value: null },
    showAuthor: { type: Boolean, value: true },
    dense: { type: Boolean, value: false },
  },
  data: {
    view: {
      sportEmoji: '🏂',
      impactLabel: '',
      timeText: '',
      parts: [],
      anonymous: false,
      selfOnly: false,
      withdrawn: false,
    } as CardView,
  },
  observers: {
    story(story: AtlasStoryCard | null) {
      if (!story) return;
      this.setData({
        view: {
          sportEmoji: SPORT_EMOJI[story.sport] ?? '🏂',
          impactLabel: IMPACT_LABEL[story.impactKind] ?? '',
          timeText: relativeTime(story.createdAt),
          parts: story.bodyParts.filter((part) => part !== 'other').map((part) => BODY_PART_LABEL[part]),
          anonymous: story.isAnonymous,
          selfOnly: story.visibility === 'self',
          withdrawn: story.publishStatus === 'withdrawn',
        },
      });
    },
  },
  methods: {
    onTap() {
      const story = this.data.story as AtlasStoryCard | null;
      if (!story) return;
      this.triggerEvent('select', { storyId: story.id });
    },
  },
});
