import { createModel } from '@rematch/core';
import { RootModel } from './index';
import { ExpenseTemplate } from '../lib/quick-access';

type QuickAccessState = {
  templates: ExpenseTemplate[]
  profileKey: string
};

export default createModel<RootModel>()({
  state: { templates: [], profileKey: '' } as QuickAccessState,
  effects: {},
  reducers: {
    setProfile(state: QuickAccessState, profileKey: string): QuickAccessState {
      return { ...state, profileKey };
    },
    saveTemplate(state: QuickAccessState, template: ExpenseTemplate): QuickAccessState {
      if (template.profileKey !== state.profileKey) return state;
      const index = state.templates.findIndex((item) => item.id === template.id && item.profileKey === state.profileKey);
      const templates = [...state.templates];
      if (index === -1) templates.push(template);
      else templates[index] = template;
      return { ...state, templates };
    },
    deleteTemplate(state: QuickAccessState, id: string): QuickAccessState {
      return { ...state, templates: state.templates.filter((item) => item.id !== id || item.profileKey !== state.profileKey) };
    },
    moveTemplate(state: QuickAccessState, { id, direction }: { id: string, direction: -1 | 1 }): QuickAccessState {
      const templates = [...state.templates];
      const indexes = templates.map((item, index) => (item.profileKey === state.profileKey ? index : -1)).filter((index) => index !== -1);
      const position = indexes.findIndex((index) => templates[index].id === id);
      const neighbor = position + direction;
      if (position < 0 || neighbor < 0 || neighbor >= indexes.length) return state;
      const from = indexes[position];
      const to = indexes[neighbor];
      [templates[from], templates[to]] = [templates[to], templates[from]];
      return { ...state, templates };
    },
  },
});
