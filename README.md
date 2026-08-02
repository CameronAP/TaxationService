# TaxationService

This API service is designed to allow a single user to be able to manage their tax position through the storage of tax payments, sale events, and sale amendments.

## Assumptions:
- Amendment dates are always after the initial invoice date
- Amendments should be applied in date order
- Amendments can add items or update existing items but cannot remove items.
- For a created transaction use the original date not the amendment dates for tax purposes.
- If an amendment has come in but not the initial invoice ignore the amendments when calculating the current tax position as we don't have the full information for the invoice.
- Only one tax payment can be made for an exact datetime due to tax payments coming without an ID so multiple payments at the same exact datetime are not supported.

## Setup:
This service is tested on Linux with the following versions and requires Node.js and npm to be installed:

``node: 26.5.1``

``npm: 11.17.0``

``nestcli: 11.0.24``


For help installing Node.js and npm see: https://docs.npmjs.com/downloading-and-installing-node-js-and-npm

Once installed run the following commands:

``npm i -g @nestjs/cli@11.0.24``

``npm install``

The base framework was generated using ``nest new <appName>``.

## Linting and Formatting

ESLint and Prettier are used for linting and formatting

Linting: ``npm run lint``

Formatting: ``npm run format``

## Running

Once installed the service can be run locally with the commands:

``npm run start``

``npm run start:dev`` to run in watch mode 

## Testing

My approach to testing was split into two parts:

1. Unit tests from the controller layer for each endpoint while mocking the database layer, allowing all core logic of the service to be tested

2. A manual testing script so the service can be tested in a repeatable manner 

Given more time and as the service expands, end-to-end testing would be critical for automated testing and CI integration.

### Unit Tests

Tests can be run using ``npm run test``

### Manual Tests
``testingRequests.http`` contains examples for each endpoint.

Following the flow, checking the tax position using the ``Get Current Tax Position`` request before and after each step, you can see the tax calculations at each step:

1. ``Create tax payment``

2. ``Create Sales Event``

3. ``Amend Sale Event``

In VS Code, installing the REST Client extension will allow you to directly call the API using that file. See the REST Client extension for more information