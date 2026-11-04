import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { parsePhoneNumberFromString } from 'libphonenumber-js/mobile'
import { mainCountryByCode, phoneCountries } from '../../lib/phoneCountries'
import { Input } from './Form'

const DEFAULT_COUNTRY = 'IN'

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' })
const countryOptions = Object.keys(phoneCountries)
  .map((code) => ({ code, name: countryNames.of(code) ?? code, dial: phoneCountries[code][0] }))
  .sort((a, b) => a.name.localeCompare(b.name))

/** "+91 9845012345" (or "9845012345" from older records) → country + national digits. */
function split(value: string): { country: string; digits: string } {
  const parsed = value ? parsePhoneNumberFromString(value, DEFAULT_COUNTRY) : undefined
  if (parsed?.country && phoneCountries[parsed.country]) return { country: parsed.country, digits: parsed.nationalNumber }
  return { country: DEFAULT_COUNTRY, digits: value.replace(/\D/g, '') }
}

/** Keeps digits only, drops a typed trunk "0" where the country's mobiles don't start with one, and caps the length. */
function clean(raw: string, country: string) {
  const [, , max, example] = phoneCountries[country]
  let digits = raw.replace(/\D/g, '')
  if (!example.startsWith('0')) digits = digits.replace(/^0+/, '')
  return digits.slice(0, max)
}

interface PhoneInputProps {
  id?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  invalid?: boolean
  'aria-describedby'?: string
}

/**
 * Country code picker + mobile number. Emits "+<code> <digits>" (or "" when empty); the number can't
 * be typed past the longest mobile number for the chosen country.
 */
export function PhoneInput({ id, value, onChange, onBlur, invalid, 'aria-describedby': describedBy }: PhoneInputProps) {
  const [country, setCountry] = useState(() => split(value).country)
  const [dial, , max, example] = phoneCountries[country]
  // Derived from the form value so resets and server data flow in; the country is kept locally.
  // Strip our own prefix rather than re-parsing: partial numbers under shared codes (+1) have no country yet.
  const prefix = `+${dial} `
  const digits = !value ? '' : value.startsWith(prefix) ? value.slice(prefix.length) : split(value).digits

  const emit = (nextCountry: string, nextDigits: string) => onChange(nextDigits ? `+${phoneCountries[nextCountry][0]} ${nextDigits}` : '')

  function handleNumber(raw: string) {
    // A full international number pasted in ("+44 7911 123456") picks its own country.
    if (raw.trim().startsWith('+')) {
      const parsed = parsePhoneNumberFromString(raw)
      if (parsed) {
        // Countries sharing a code (+44 GB/GG/JE) can't always be told apart: keep the current one if it matches.
        const code = parsed.countryCallingCode
        const next = phoneCountries[country][0] === code ? country : mainCountryByCode[code]
        if (next && phoneCountries[next]) {
          setCountry(next)
          return emit(next, clean(parsed.nationalNumber, next))
        }
      }
    }
    emit(country, clean(raw, country))
  }

  function handleCountry(next: string) {
    setCountry(next)
    emit(next, clean(digits, next))
  }

  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 flex w-[5.5rem] items-center border-r border-line">
        <span className="pointer-events-none flex w-full items-center justify-between gap-1 pr-2 pl-3 text-sm text-ink" aria-hidden="true">
          <span>
            <span className="text-muted">{country}</span> +{dial}
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-zinc-500" />
        </span>
        <select
          value={country}
          onChange={(e) => handleCountry(e.target.value)}
          onBlur={onBlur}
          aria-label="Country code"
          className="absolute inset-0 cursor-pointer rounded-l-lg opacity-0"
        >
          {countryOptions.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} (+{c.dial})
            </option>
          ))}
        </select>
      </div>
      <Input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={max}
        placeholder={example}
        value={digits}
        onChange={(e) => handleNumber(e.target.value)}
        onPaste={(e) => {
          // maxLength would truncate "+44 7911 123456" before it can be parsed.
          e.preventDefault()
          handleNumber(e.clipboardData.getData('text'))
        }}
        onBlur={onBlur}
        aria-describedby={describedBy}
        invalid={invalid}
        className="pl-[6.25rem] tabular-nums"
      />
    </div>
  )
}
