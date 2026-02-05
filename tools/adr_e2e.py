import argparse
import asyncio
import importlib.util
import json
import re
import sys


def ensure_playwright():
  if importlib.util.find_spec('playwright') is None:
    print('Playwright is not installed. Install it or run manual checks instead.')
    sys.exit(2)


ensure_playwright()

from playwright.async_api import async_playwright  # noqa: E402


async def compute_answer(page):
  text = (await page.text_content('#game-question') or '').strip()
  match = re.match(r'\s*(\d+)\s*([+\-×÷])\s*(\d+)\s*', text)
  if not match:
    raise ValueError(f'Unexpected question format: {text!r}')
  left = int(match.group(1))
  op = match.group(2)
  right = int(match.group(3))
  if op == '+':
    return left + right
  if op == '-':
    return left - right
  if op == '×':
    return left * right
  if op == '÷':
    return left // right if right != 0 else 0
  raise ValueError(f'Unknown operator: {op}')


async def wait_for_time_left(page, target):
  for _ in range(50):
    text = (await page.text_content('#game-time-left') or '').strip()
    if text == str(target):
      return True
    await page.wait_for_timeout(200)
  return False


async def start_free_game(page, profile_id):
  await page.click(f'[data-profile-id="{profile_id}"]')
  await page.click('#profile-select-continue')
  await page.click('#title-free-button')
  await page.click('#settings-play-button')
  await page.wait_for_selector('#game-screen', state='visible')


async def open_settings_details(page):
  details = page.locator('details.settings-details')
  if await details.get_attribute('open') is None:
    await page.click('summary.settings-details__summary')
    await page.wait_for_timeout(100)


async def submit_answer(page, method):
  await page.wait_for_selector('#game-answer-input', state='visible', timeout=5000)
  question = (await page.text_content('#game-question') or '').strip()
  answer = await compute_answer(page)
  await page.fill('#game-answer-input', str(answer))
  if method == 'enter':
    await page.press('#game-answer-input', 'Enter')
  else:
    await page.click('#game-submit-button', click_count=3 if method == 'rapid' else 1)
  for _ in range(30):
    if await page.locator('#result-screen').is_visible():
      return
    current = (await page.text_content('#game-question') or '').strip()
    if current != question:
      return
    await page.wait_for_timeout(200)
  raise RuntimeError('Timed out waiting for next question or result screen')


async def run(base_url):
  results = []
  async with async_playwright() as p:
    browser = await p.firefox.launch()
    page = await browser.new_page()
    await page.goto(f'{base_url}?test=1&timeLimit=5', wait_until='domcontentloaded')

    t1_profile_visible = await page.locator('#profile-select-screen').is_visible()
    t1_title_hidden = await page.locator('#title-screen').is_hidden()
    results.append({'id': 'T1', 'pass': t1_profile_visible and t1_title_hidden})

    await page.click('[data-profile-id="B"]')
    label = (await page.text_content('#profile-select-current') or '').strip()
    await page.click('#profile-select-continue')
    title_visible = await page.locator('#title-screen').is_visible()
    results.append({'id': 'T2', 'pass': label == 'B' and title_visible})

    last_profile = await page.evaluate('localStorage.getItem("calc-sprint::meta::last-profile")')
    results.append({'id': 'T3', 'pass': last_profile == 'B'})

    await page.click('#title-free-button')
    await page.click('#settings-profile-button')
    profile_visible = await page.locator('#profile-select-screen').is_visible()
    results.append({'id': 'T4', 'pass': profile_visible})

    async def play_one_round(profile_id):
      await start_free_game(page, profile_id)
      await submit_answer(page, 'click')
      await page.wait_for_selector('#result-screen', state='visible', timeout=10000)
      daily_key = f'calc-sprint::{profile_id}::daily.v1'
      rank_key = f'calc-sprint::{profile_id}::rank.distance.today.v1'
      daily_val = await page.evaluate('(key) => localStorage.getItem(key)', daily_key)
      rank_val = await page.evaluate('(key) => localStorage.getItem(key)', rank_key)
      return {'daily': daily_val, 'rank': rank_val}

    a_data = await play_one_round('A')
    await page.click('#result-back-button')
    await page.click('#settings-profile-button')
    b_data = await play_one_round('B')
    await page.click('#result-back-button')

    t5_pass = bool(a_data['daily']) and bool(a_data['rank']) and bool(b_data['daily']) and bool(b_data['rank'])
    t5_pass = t5_pass and (a_data['daily'] != b_data['daily'] or a_data['rank'] != b_data['rank'])
    results.append({'id': 'T5', 'pass': t5_pass})

    await page.click('#settings-profile-button')
    await page.click('[data-profile-id="A"]')
    await page.click('#profile-select-continue')
    await page.click('#title-free-button')
    await open_settings_details(page)
    page.once('dialog', lambda dialog: asyncio.create_task(dialog.accept()))
    await page.click('#settings-profile-reset')
    await page.wait_for_timeout(300)
    a_daily = await page.evaluate('localStorage.getItem("calc-sprint::A::daily.v1")')
    a_rank = await page.evaluate('localStorage.getItem("calc-sprint::A::rank.distance.today.v1")')
    b_daily = await page.evaluate('localStorage.getItem("calc-sprint::B::daily.v1")')
    b_rank = await page.evaluate('localStorage.getItem("calc-sprint::B::rank.distance.today.v1")')
    results.append({'id': 'T6', 'pass': a_daily is None and a_rank is None and b_daily is not None and b_rank is not None})

    await page.goto(f'{base_url}?test=1&timeLimit=20', wait_until='domcontentloaded')
    await start_free_game(page, 'C')

    before = int((await page.text_content('#game-correct-count') or '0').strip())
    await submit_answer(page, 'enter')
    after_enter = int((await page.text_content('#game-correct-count') or '0').strip())
    results.append({'id': 'E1', 'pass': after_enter == before + 1})

    before = after_enter
    await submit_answer(page, 'click')
    after_click = int((await page.text_content('#game-correct-count') or '0').strip())
    results.append({'id': 'E2', 'pass': after_click == before + 1})

    await page.click('#game-keypad-toggle')
    await page.click('[data-keypad-key="1"]')
    await page.click('[data-keypad-key="2"]')
    keypad_val = await page.input_value('#game-answer-input')
    results.append({'id': 'E3', 'pass': keypad_val.endswith('12')})
    await submit_answer(page, 'click')

    before = int((await page.text_content('#game-correct-count') or '0').strip())
    await submit_answer(page, 'rapid')
    after_rapid = int((await page.text_content('#game-correct-count') or '0').strip())
    results.append({'id': 'E4', 'pass': after_rapid == before + 1})

    await page.goto(f'{base_url}?test=1&timeLimit=5', wait_until='domcontentloaded')
    await start_free_game(page, 'D')
    time_left_ready = await wait_for_time_left(page, 1)
    await submit_answer(page, 'click')
    await page.wait_for_selector('#result-screen', state='visible', timeout=10000)
    results.append({'id': 'E5', 'pass': time_left_ready})

    await browser.close()
  return results


def main():
  parser = argparse.ArgumentParser()
  parser.add_argument('--base-url', default='http://127.0.0.1:8082/')
  args = parser.parse_args()

  results = asyncio.run(run(args.base_url))
  print(json.dumps(results, ensure_ascii=False))


if __name__ == '__main__':
  main()
