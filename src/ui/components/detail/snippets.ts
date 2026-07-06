import type { ApiEntry } from '../../../data/seed'

export const SNIPPETS = (api: ApiEntry) => {
  const url = `${api.baseUrl}${api.sampleEndpoint}`
  return [
    { label: 'CURL', code: `curl "${url}"` },
    {
      label: 'FETCH',
      code: `const res = await fetch("${url}");\nconst data = await res.json();\nconsole.log(data);`,
    },
    {
      label: 'PYTHON',
      code: `import requests\n\nres = requests.get("${url}")\nprint(res.json())`,
    },
  ]
}
