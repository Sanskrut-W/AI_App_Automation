const FIRST_NAMES = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie', 'Drew'];
const SURNAMES = ['Smith', 'Johnson', 'Brown', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White'];
/** South African mobile numbers (once the "+27" dialing-code prefix already shown on the form is
 * accounted for) start with one of these digits. */
const MOBILE_LEAD_DIGITS = ['6', '7', '8'];

export interface RandomSignUpDetails {
  mobileNumber: string;
  password: string;
  firstName: string;
  surname: string;
  email: string;
  /** A South African passport number is one uppercase letter followed by 7 digits (e.g. "A1234567"),
   * matching the format observed on the real Betway ZA KYC/registration-details screen. */
  passportNumber: string;
}

/** Fresh, plausible-looking dummy registration details — a new set every call, so re-running
 * sign-up test case generation never collides with an account "created" by a previous run. */
export function generateRandomSignUpDetails(): RandomSignUpDetails {
  const firstName = pick(FIRST_NAMES);
  const surname = pick(SURNAMES);
  const emailSuffix = randomDigits(5);

  return {
    mobileNumber: pick(MOBILE_LEAD_DIGITS) + randomDigits(8),
    // Mixes letters and digits and lands in the 8-10 character range the real form's own hint
    // text ("8 - 10 characters") requires.
    password: randomAlpha(5) + randomDigits(4),
    firstName,
    surname,
    email: `${firstName.toLowerCase()}.${surname.toLowerCase()}${emailSuffix}@example.com`,
    passportNumber: randomUpperAlpha(1) + randomDigits(7),
  };
}

function pick<T>(values: T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}

function randomUpperAlpha(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += String.fromCharCode(65 + Math.floor(Math.random() * 26));
  }
  return result;
}

function randomDigits(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
}

function randomAlpha(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += String.fromCharCode(97 + Math.floor(Math.random() * 26));
  }
  return result;
}
