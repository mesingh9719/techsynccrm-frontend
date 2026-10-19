import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { companySizes, createWorkspaceSchema, industries, type CreateWorkspaceValues } from '../lib/schemas'
import { applyServerErrors } from '../lib/forms'
import { Dialog } from '../components/app/Dialog'
import { Button } from '../components/ui/Button'
import { Field, FormAlert, Input, Select } from '../components/ui/Form'
import { useWorkspaceSwitch } from './useWorkspaceSwitch'

/** Create an additional workspace (e.g. a second business) and switch to it. */
export function CreateWorkspaceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createAndSwitch } = useWorkspaceSwitch()
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateWorkspaceValues>({ resolver: zodResolver(createWorkspaceSchema), defaultValues: { company: '' } })

  function close() {
    reset()
    setServerError(null)
    onClose()
  }

  const onSubmit = async (values: CreateWorkspaceValues) => {
    setServerError(null)
    try {
      await createAndSwitch(values)
      close()
    } catch (err) {
      setServerError(applyServerErrors(err, setError, ['company', 'industry', 'teamSize']))
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Create a workspace"
      description="A separate workspace with its own leads, deals and team — for another business or branch. It starts on the free Starter plan."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="create-workspace-form" loading={isSubmitting}>
            Create workspace
          </Button>
        </>
      }
    >
      <form id="create-workspace-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Field label="Company name" error={errors.company?.message}>
          {({ id, describedBy, invalid }) => <Input id={id} autoComplete="organization" aria-describedby={describedBy} invalid={invalid} {...register('company')} />}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Industry" error={errors.industry?.message}>
            {({ id, describedBy, invalid }) => (
              <Select id={id} aria-describedby={describedBy} invalid={invalid} defaultValue="" {...register('industry')}>
                <option value="" disabled>
                  Choose
                </option>
                {industries.map((i) => (
                  <option key={i}>{i}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Team size" error={errors.teamSize?.message}>
            {({ id, describedBy, invalid }) => (
              <Select id={id} aria-describedby={describedBy} invalid={invalid} defaultValue="" {...register('teamSize')}>
                <option value="" disabled>
                  Choose
                </option>
                {companySizes.map((s) => (
                  <option key={s} value={s}>
                    {s} people
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        {serverError && <FormAlert>{serverError}</FormAlert>}
      </form>
    </Dialog>
  )
}
