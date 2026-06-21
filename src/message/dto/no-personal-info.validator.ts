import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;
// Détecte les numéros avec au moins 7 chiffres consécutifs (espaces/tirets/parenthèses tolérés)
const PHONE_REGEX = /(\+?\d[\d\s\-().]{5,}\d)/;

@ValidatorConstraint({ name: 'noPersonalInfo', async: false })
export class NoPersonalInfoConstraint implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    return !EMAIL_REGEX.test(value) && !PHONE_REGEX.test(value);
  }

  defaultMessage(): string {
    return "Le message ne peut pas contenir d'adresse email ou de numéro de téléphone";
  }
}

export function NoPersonalInfo(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: NoPersonalInfoConstraint,
    });
  };
}
