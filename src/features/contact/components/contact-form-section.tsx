import { Section } from '@/components/layout'
import { Button, Card, GradientText, Input, SectionEyebrow, Textarea } from '@/components/ui'
import { SERVICE_ICONS } from '@/components/shared'
import { useContactForm } from '../hooks/use-contact-form'
import { CONTACT_FORM_CONTENT } from '../data/contact.data'

/**
 * The contact form. **[RECONSTRUCTED — no reference exists]**
 *
 * inspiration/contact-us(screenshot).png leaves ~960 CSS px blank between the
 * notice card and the footer: the form did not render
 * (REFERENCE-LIMITATIONS.md → Contact Form Gap). The hero's verified line
 * "Fill out the form or reach out directly" proves a form belongs here, but the
 * field list, labels, layout, submit copy and every state are inferred.
 *
 * Kept to the three fields a message genuinely needs — name, email, message.
 * Nothing beyond that is invented: no company, budget, phone or subject field,
 * per CLAUDE.md §11.
 *
 * Visual language is borrowed from the measured surroundings rather than
 * guessed: the standard #160E35 card at 24px radius, the shared 14px-radius
 * inputs, and the gradient hero pill for submit.
 */
export function ContactFormSection() {
  const { values, errors, status, submitError, setValue, handleSubmit, reset } =
    useContactForm()

  const CheckIcon = SERVICE_ICONS.check
  const isSubmitting = status === 'submitting'

  return (
    <Section id="contact-form" className="pb-[74px] md:pb-20">
      <div className="max-w-[382px] lg:max-w-none">
        <SectionEyebrow>{CONTACT_FORM_CONTENT.eyebrow}</SectionEyebrow>

        <h2 className="mt-[22px] text-[31px] sm:text-4xl lg:text-[40px]">
          {CONTACT_FORM_CONTENT.title}{' '}
          <GradientText>{CONTACT_FORM_CONTENT.titleAccent}</GradientText>
        </h2>

        <p className="mt-[26px] max-w-[382px] text-[17px] leading-[29px] text-text-muted sm:max-w-[62ch]">
          {CONTACT_FORM_CONTENT.description}
        </p>

        <Card className="mt-[38px] max-w-[382px] sm:max-w-[620px]">
          {status === 'success' ? (
            /* Success replaces the fields so the outcome cannot be missed. The
               live region announces it to screen readers. */
            <div role="status" className="flex flex-col items-start gap-4 py-2">
              <span
                aria-hidden="true"
                className="inline-flex size-12 items-center justify-center rounded-tile border border-border bg-primary-start/12 text-primary-mid"
              >
                <CheckIcon className="size-6" />
              </span>

              <h3 className="text-[22px]">{CONTACT_FORM_CONTENT.successTitle}</h3>

              <p className="text-[16px] leading-[1.65] text-text-muted">
                {CONTACT_FORM_CONTENT.successBody}
              </p>

              <Button variant="secondary" size="sm" className="mt-2 px-6" onClick={reset}>
                {CONTACT_FORM_CONTENT.successAction}
              </Button>
            </div>
          ) : (
            <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
              <Input
                label="Name"
                name="name"
                autoComplete="name"
                value={values.name}
                error={errors.name}
                onChange={(event) => setValue('name', event.target.value)}
                placeholder="Your full name"
              />

              <Input
                label="Email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={values.email}
                error={errors.email}
                onChange={(event) => setValue('email', event.target.value)}
                placeholder="you@company.com"
              />

              <Textarea
                label="Message"
                name="message"
                rows={5}
                value={values.message}
                error={errors.message}
                onChange={(event) => setValue('message', event.target.value)}
                placeholder="Tell us what you're looking for."
              />

              {/* Submission failure, distinct from the per-field messages. */}
              {submitError && (
                <p
                  role="alert"
                  className="rounded-input border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                >
                  {submitError}
                </p>
              )}

              <Button type="submit" isLoading={isSubmitting} className="mt-1 w-full sm:w-auto sm:self-start">
                {CONTACT_FORM_CONTENT.submitLabel}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </Section>
  )
}
