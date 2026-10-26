import model from '../quickAccess';
import { initialSplit } from '../transactions';

const first = {
  id: 'first', name: 'Coffee', profileKey: 'one', split: initialSplit(),
};
const second = { ...first, id: 'second', name: 'Lunch' };
const other = { ...first, id: 'other', profileKey: 'two' };
const initial = { profileKey: 'one', templates: [first, other, second] };

test('template writes are restricted to the active profile', () => {
  expect(model.reducers.saveTemplate(initial, { ...other, name: 'Changed' })).toBe(initial);
  expect(model.reducers.deleteTemplate(initial, other.id).templates).toEqual(initial.templates);
});

test('moving a template preserves other profiles and stable identifiers', () => {
  const moved = model.reducers.moveTemplate(initial, { id: second.id, direction: -1 });
  expect(moved.templates.map((item) => item.id)).toEqual(['second', 'other', 'first']);
  expect(initial.templates.map((item) => item.id)).toEqual(['first', 'other', 'second']);
});

test('saving edits replaces the template without duplicating it', () => {
  const edited = model.reducers.saveTemplate(initial, { ...first, name: 'Tea' });
  expect(edited.templates).toHaveLength(3);
  expect(edited.templates[0].name).toBe('Tea');
  expect(initial.templates[0].name).toBe('Coffee');
});
