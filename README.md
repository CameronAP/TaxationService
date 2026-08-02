# TaxationService

## Setup:
This service is designed to be run in linux relies on having node and npm installed. See for help installing node and npm https://docs.npmjs.com/downloading-and-installing-node-js-and-npm

Once installed run the following commands:

``npm i -g @nestjs/cli@11.0.24``

``npm install``

This service has been tested with versions:

``node: 26.5.1``

``npm: 11.17.0``

``nestcli: 11.0.24``

The base framework was generated using ``nest new <appName>``.

## Linting and Formatting

Eslint and prettier are using for linting and formatting

Linting: ``npm run lint``

Formatting: ``npm run format``

## Running

Once installed the service can be run with the commands:

``npm run start`` or ``npm run start:dev`` 

## Assumptions:
- Amendment dates are always after the initial invoice date
- Amendments should be applied in date order
- Amendments can add items or update existing items but cannot remove items.
- For a created transaction use the original date not the Amendment dates for tax purposes.
- If an amendment has come in but not the initial invoice ignore the Amendments when calculating the current tax position as we dont have the full information for the invoice.
- Only 1 tax payment can be made for an exact datetime due to tax payments coming without an ID so multiple payments at the same exact datetime are not supported.

## Testing

### Unit

All endpoints from the controller level have been tested. Tests can be run using ``npm run test``

### Manual
For manual testing the ``testingRequests.http`` shows how each endpoint should be used.
In VS Code installing the REST Client extension will allow you to directly call the api using that file. See the REST Client extension for more information
