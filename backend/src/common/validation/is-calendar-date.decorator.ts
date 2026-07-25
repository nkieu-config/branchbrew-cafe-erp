import { registerDecorator, ValidationOptions } from 'class-validator';
import { isCalendarDate } from '../query-params.util';

export function IsCalendarDate(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isCalendarDate',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) => isCalendarDate(value),
        defaultMessage: (args) =>
          `${args?.property ?? 'value'} must be a real calendar date in YYYY-MM-DD form.`,
      },
    });
  };
}
