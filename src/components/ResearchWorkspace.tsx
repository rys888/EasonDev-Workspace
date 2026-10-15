import type { RefObject } from 'react'

type Props = {
  backButtonRef: RefObject<HTMLButtonElement | null>
  onBack: () => void
}

export function ResearchWorkspace({ backButtonRef, onBack }: Props) {
  return (
    <main className="research-workspace" aria-labelledby="research-title">
      <button
        ref={backButtonRef}
        className="research-workspace__back"
        type="button"
        onClick={onBack}
      >
        <span aria-hidden="true">&#8592;</span>
        Back to Room
      </button>

      <section className="research-workspace__intro">
        <h1 id="research-title">Research Workspace</h1>
        <div className="research-workspace__placeholder" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </section>
    </main>
  )
}
