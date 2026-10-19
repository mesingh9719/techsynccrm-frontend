import type { ContentBlock } from '../../types'
import { slugify } from '../../lib/format'

/** Renders structured rich text from the CMS-style JSON blocks. */
export function ContentBlocks({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'h2':
            return (
              <h2 key={i} id={slugify(block.text)}>
                {block.text}
              </h2>
            )
          case 'h3':
            return <h3 key={i}>{block.text}</h3>
          case 'ul':
            return (
              <ul key={i}>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol key={i}>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            )
          case 'quote':
            return <blockquote key={i}>{block.text}</blockquote>
          default:
            return <p key={i}>{block.text}</p>
        }
      })}
    </>
  )
}
