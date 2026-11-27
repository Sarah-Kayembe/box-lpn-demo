/** The red star after a required field's label. Screen readers hear "required". */
export function Required() {
  return (
    <>
      <span className="ml-0.5 text-red-deep" aria-hidden="true">
        *
      </span>
      <span className="sr-only"> (required)</span>
    </>
  );
}
