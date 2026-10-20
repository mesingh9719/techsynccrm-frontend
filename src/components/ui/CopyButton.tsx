import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from './Button'
import { useToast } from './Toast'

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const notify = useToast()
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      notify({ tone: 'error', title: 'Couldn’t copy', description: 'Select the text and copy it using your keyboard.' })
    }
  }
  return (
    <Button size="sm" variant="secondary" onClick={copy} onBlur={() => setCopied(false)}>
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? 'Copied' : label}
    </Button>
  )
}
