import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Select, SelectOption } from './select';
import { Checkbox } from './checkbox';

@Component({
  imports: [Select, Checkbox],
  template: `
    <ui-select label="Fruit" [options]="opts" [(value)]="value" />
    <ui-checkbox [(checked)]="on">Remember</ui-checkbox>
  `,
})
class Host {
  readonly opts: SelectOption[] = [
    { value: 'a', label: 'Apple' },
    { value: 'b', label: 'Banana' },
    { value: 'c', label: 'Cherry' },
  ];
  readonly value = signal('a');
  readonly on = signal(false);
}

async function setup() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;
  const trigger = el.querySelector<HTMLButtonElement>('[role=combobox]');
  if (!trigger) throw new Error('trigger missing');
  const key = async (k: string) => {
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    await fixture.whenStable();
  };
  return { fixture, el, trigger, key, host: fixture.componentInstance };
}

describe('ui-select', () => {
  it('shows the selected label and is named by its visible label', async () => {
    const { trigger, el } = await setup();
    expect(trigger.textContent).toContain('Apple');
    const labelId = trigger.getAttribute('aria-labelledby')?.split(' ')[0] ?? '';
    expect(el.querySelector(`#${labelId}`)?.textContent).toBe('Fruit');
  });

  it('opens with the keyboard, moves and picks with Enter', async () => {
    const { trigger, key, host, el } = await setup();
    await key('ArrowDown');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelectorAll('[role=option]').length).toBe(3);
    await key('ArrowDown');
    await key('Enter');
    expect(host.value()).toBe('b');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('supports type-ahead and closes on Escape without changing the value', async () => {
    const { trigger, key, host } = await setup();
    await key('Enter');
    await key('c');
    expect(trigger.getAttribute('aria-activedescendant')).toMatch(/-2$/);
    await key('Escape');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(host.value()).toBe('a');
  });

  it('picks with a click', async () => {
    const { fixture, trigger, el, host } = await setup();
    trigger.click();
    await fixture.whenStable();
    el.querySelectorAll<HTMLElement>('[role=option]')[2]?.click();
    await fixture.whenStable();
    expect(host.value()).toBe('c');
  });
});

describe('ui-checkbox', () => {
  it('toggles its model through the real checkbox', async () => {
    const { fixture, el, host } = await setup();
    const box = el.querySelector<HTMLInputElement>('ui-checkbox input[type=checkbox]');
    box?.click();
    await fixture.whenStable();
    expect(host.on()).toBe(true);
    expect(box?.checked).toBe(true);
  });
});
