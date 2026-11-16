import { ConfirmService } from './confirm.service';

describe('ConfirmService', () => {
  it('resolves with the answer and clears the prompt', async () => {
    const svc = new ConfirmService();
    const p = svc.ask({ title: 'T', message: 'M' });
    expect(svc.pending()?.title).toBe('T');
    svc.answer(true);
    await expect(p).resolves.toBe(true);
    expect(svc.pending()).toBeNull();
  });

  it('treats a superseded prompt as cancelled', async () => {
    const svc = new ConfirmService();
    const first = svc.ask({ title: 'first', message: '' });
    const second = svc.ask({ title: 'second', message: '' });
    await expect(first).resolves.toBe(false);
    svc.answer(true);
    await expect(second).resolves.toBe(true);
  });
});
