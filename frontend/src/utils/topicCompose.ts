type TemplateLike = {
  id: string
  effective: boolean
}

export function pickDefaultTopicTemplateId<T extends TemplateLike>(templates: T[]): string {
  const effective = templates.find((item) => item.effective)
  if (effective) return effective.id
  return templates[0]?.id || ''
}
