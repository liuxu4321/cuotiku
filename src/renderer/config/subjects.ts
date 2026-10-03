import type { Component } from 'vue'
import { Atom, BookOpen, Calculator, Dna, FlaskConical, Languages } from '@lucide/vue'
import type { Subject } from '@shared/types'

export const ALL_SUBJECTS: Subject[] = ['语文', '数学', '英语', '物理', '化学', '生物']

export const subjectIcons: Record<Subject, Component> = {
  语文: BookOpen,
  数学: Calculator,
  英语: Languages,
  物理: Atom,
  化学: FlaskConical,
  生物: Dna,
}

export function subjectsForGrade(grade: number): Subject[] {
  if (grade <= 2) return ['语文', '数学']
  if (grade <= 7) return ['语文', '数学', '英语']
  if (grade === 8) return ['语文', '数学', '英语', '物理']
  if (grade <= 9) return ['语文', '数学', '英语', '物理', '化学']
  return ['语文', '数学', '英语', '物理', '化学', '生物']
}
