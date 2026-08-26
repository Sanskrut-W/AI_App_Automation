import { generateRandomSignUpDetails } from '../../../../src/shared/random/generateRandomSignUpDetails';

describe('generateRandomSignUpDetails', () => {
  it('generates a mobile number matching a plausible South African local number (9 digits, no leading 0)', () => {
    const details = generateRandomSignUpDetails();
    expect(details.mobileNumber).toMatch(/^[678]\d{8}$/);
  });

  it('generates a password within the 8-10 character range the real form requires', () => {
    const details = generateRandomSignUpDetails();
    expect(details.password.length).toBeGreaterThanOrEqual(8);
    expect(details.password.length).toBeLessThanOrEqual(10);
    expect(details.password).toMatch(/[a-z]/);
    expect(details.password).toMatch(/[0-9]/);
  });

  it('generates a first name, surname, and an email derived from them', () => {
    const details = generateRandomSignUpDetails();
    expect(details.firstName.length).toBeGreaterThan(0);
    expect(details.surname.length).toBeGreaterThan(0);
    expect(details.email).toBe(
      `${details.firstName.toLowerCase()}.${details.surname.toLowerCase()}${details.email.match(/(\d+)@/)?.[1]}@example.com`,
    );
    expect(details.email).toMatch(/^[a-z]+\.[a-z]+\d+@example\.com$/);
  });

  it("generates a passport number matching the real form's letter + 7-digit format", () => {
    const details = generateRandomSignUpDetails();
    expect(details.passportNumber).toMatch(/^[A-Z]\d{7}$/);
  });

  it('generates different details on successive calls', () => {
    const first = generateRandomSignUpDetails();
    const second = generateRandomSignUpDetails();
    expect(first).not.toEqual(second);
  });
});
