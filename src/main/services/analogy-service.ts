import type { AnalogyDocument, AnalogyItem, CollectionEntry } from '@shared/types'
import { listEntries } from './collection-service'
import { printHtml } from './output-service'
import type { BrowserWindow } from 'electron'

export async function generateAnalogy(entryIds: string[]): Promise<AnalogyDocument> {
  const entries = await listEntries()
  const picked = entryIds
    .map((id) => entries.find((entry) => entry.id === id))
    .filter((entry): entry is CollectionEntry => Boolean(entry))
  if (!picked.length) throw new Error('未找到所选错题，请刷新错题集后重试。')
  const items: AnalogyItem[] = picked.map((entry) => ({
    entryId: entry.id,
    thumbDataUrl: entry.thumbDataUrl,
    subject: entry.subject,
    grade: entry.grade,
    errorType: entry.errorType,
    questions: buildQuestions(entry.subject, entry.grade),
  }))
  return { title: '举一反三练习', createdAt: Date.now(), items }
}

export async function printAnalogy(
  parent: BrowserWindow | null,
  document: AnalogyDocument,
): Promise<boolean> {
  const sections = document.items
    .map(
      (item) =>
        `<section class="item"><h2>${escapeHtml(item.subject)} · ${item.grade}年级 · 错误类型：${escapeHtml(item.errorType)}</h2>` +
        `<img src="${item.thumbDataUrl}" alt="原错题">` +
        `<ol>${item.questions.map((question) => `<li>${escapeHtml(question)}</li>`).join('')}</ol></section>`,
    )
    .join('')
  const html =
    `<title>${escapeHtml(document.title)}</title>` +
    `<style>@page{size:A4;margin:14mm}body{font-family:sans-serif;color:#111}` +
    `h1{font-size:20px;margin:0 0 4mm}h2{font-size:14px;margin:0 0 3mm}` +
    `.item{border:1px solid #bbb;border-radius:6px;padding:4mm;margin-bottom:5mm;page-break-inside:avoid}` +
    `.item img{display:block;max-height:60mm;max-width:100%;object-fit:contain;margin-bottom:3mm}` +
    `ol{margin:0;padding-left:6mm}li{margin-bottom:2mm;font-size:13px}</style>` +
    `<h1>${escapeHtml(document.title)}</h1>${sections}`
  return printHtml(parent, html)
}

function buildQuestions(subject: CollectionEntry['subject'], grade: number): string[] {
  if (subject === '数学') return mathQuestions(grade)
  if (subject === '英语') return englishQuestions()
  return chineseQuestions()
}
function mathQuestions(grade: number): string[] {
  const bound = grade <= 2 ? 100 : grade <= 4 ? 1000 : 10000
  const questions: string[] = []
  for (let index = 0; index < 2; index += 1) {
    const a = rand(Math.round(bound / 10), bound)
    const b = rand(2, Math.round(bound / 10))
    const ops = grade <= 2 ? ['+', '-'] : ['+', '-', '×']
    const op = ops[rand(0, ops.length - 1)]!
    questions.push(`计算：${a} ${op} ${b} = ？`)
  }
  const a = rand(3, 40)
  const b = rand(3, 40)
  questions.push(
    grade <= 4
      ? `应用题：小明有 ${a} 支铅笔，小红比他多 ${b} 支，两人一共有多少支？`
      : `应用题：一本书共 ${a * b} 页，每天看 ${a} 页，看完需要多少天？`,
  )
  return questions
}
function chineseQuestions(): string[] {
  const sentences = [
    '天上的白云像________一样。',
    '________一边________，一边________。',
    '读了这个故事，我明白了________。',
    '春天到了，________都________。',
  ]
  const words = ['认真', '温暖', '明亮', '勇敢']
  return [
    `仿写句子：${sentences[rand(0, sentences.length - 1)]}`,
    `用「${words[rand(0, words.length - 1)]}」写一句话。`,
    '把今天错题中的句子工整抄写一遍，并标出容易写错的字。',
  ]
}
function englishQuestions(): string[] {
  const words = ['apple', 'school', 'friend', 'happy', 'morning']
  const blanks = [
    'I ___ (go) to school every day.',
    'She ___ (like) reading books.',
    'There ___ (be) a pen on the desk.',
  ]
  return [
    `Write a sentence with the word "${words[rand(0, words.length - 1)]}".`,
    `Fill in the blank: ${blanks[rand(0, blanks.length - 1)]}`,
    'Translate into English: 我每天早上读英语。',
  ]
}
function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
