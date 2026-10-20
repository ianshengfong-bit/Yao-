import test from 'node:test';
import assert from 'node:assert/strict';
import {interpret, parseDate, parseTime} from '../smart-entry.js';

const now = new Date(2026, 9, 20, 10);
globalThis.window = {YaoWorkspace: {listProjects: () => [
  {id:'pz', name:'朴子消防工程', code:'PZ', archived:false}
]}};

test('中文時間、案場簡稱與未要求提醒', () => {
  const p = interpret('朴子21號早上八點開會', now);
  assert.equal(p.project.id, 'pz');
  assert.equal(p.date, '2026-10-21');
  assert.equal(p.time, '08:00');
  assert.equal(p.semanticType, '會議');
  assert.equal(p.type, '工作');
  assert.equal(p.reminder.has, false);
  assert.equal(p.reminder.lead, 'none');
});

test('日期不能誤當時間，且時間支援中文與24小時制', () => {
  for (const [text, result] of [
    ['21號', ''], ['早上八點','08:00'], ['下午三點半','15:30'],
    ['上午8時15分','08:15'], ['晚上十二點','00:00'], ['14:45','14:45']
  ]) assert.equal(parseTime(text), result, text);
});

test('日期跨月、跨年及不合法日期', () => {
  assert.equal(parseDate('31號', new Date(2026,1,20)).getMonth(), 2);
  assert.equal(parseDate('明天', new Date(2026,11,31)).getFullYear(), 2027);
  assert.equal(interpret('2月30日開會', now).invalidDate, true);
  assert.equal(interpret('下個月5號', now).date, '2026-11-05');
});

test('提醒與工務類型保持原表單格式', () => {
  const p = interpret('監察院21號R型總機進場，前一天提醒', now);
  assert.equal(p.type, '進料');
  assert.equal(p.reminder.lead, '1');
  assert.equal(interpret('提前一小時提醒', now).reminder.oneHour, true);
  assert.equal(interpret('提前兩天提醒', now).reminder.unsupported, true);
  assert.equal(interpret('提前二天提醒', now).reminder.unsupported, true);
});

test('案場簡稱有多個符合時留給使用者確認', () => {
  const original = window.YaoWorkspace.listProjects;
  window.YaoWorkspace.listProjects = () => [
    {id:'1',name:'朴子甲工程'}, {id:'2',name:'朴子乙工程'}
  ];
  try { assert.equal(interpret('朴子21號開會', now).project, null); }
  finally { window.YaoWorkspace.listProjects = original; }
});
