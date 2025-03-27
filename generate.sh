#!/bin/bash

# ESLint configuration
if [ ! -f ".eslintrc.json" ]; then
  echo "Creating .eslintrc.json..."
  cat <<EOL > .eslintrc.json
{
  "env": {
    "browser": true,
    "node": true,
    "es6": true
  },
  "extends": "eslint:recommended",
  "parserOptions": {
    "ecmaVersion": 2020,
    "sourceType": "module"
  },
  "rules": {
    "no-unused-vars": "warn",
    "no-console": "off"
  }
}
EOL
fi

# Prettier configuration
if [ ! -f ".prettierrc.js" ]; then
  echo "Creating .prettierrc.js..."
  cat <<EOL > .prettierrc.js
module.exports = {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  trailingComma: "es5",
  bracketSpacing: true,
  arrowParens: "avoid"
};
EOL
fi

# Stylelint configuration
if [ ! -f ".stylelintrc.json" ]; then
  echo "Creating .stylelintrc.json..."
  cat <<EOL > .stylelintrc.json
{
  "rules": {
    "color-no-invalid-hex": true,
    "font-family-no-duplicate-names": true,
    "function-calc-no-unspaced-operator": true,
    "unit-no-unknown": true,
    "property-no-unknown": true,
    "declaration-block-no-duplicate-properties": true
  }
}
EOL
fi

# Markdownlint configuration
if [ ! -f ".markdownlint.json" ]; then
  echo "Creating .markdownlint.json..."
  cat <<EOL > .markdownlint.json
{
  "default": true,
  "line-length": false,
  "no-trailing-punctuation": false,
  "no-inline-html": false
}
EOL
fi

# ESLint ignore file
if [ ! -f ".eslintignore" ]; then
  echo "Creating .eslintignore..."
  cat <<EOL > .eslintignore
node_modules/
dist/
EOL
fi

# Stylelint ignore file
if [ ! -f ".stylelintignore" ]; then
  echo "Creating .stylelintignore..."
  cat <<EOL > .stylelintignore
node_modules/
dist/
EOL
fi

# Markdownlint ignore file
if [ ! -f ".markdownlintignore" ]; then
  echo "Creating .markdownlintignore..."
  cat <<EOL > .markdownlintignore
node_modules/
dist/
EOL
fi

echo "Configuration and ignore files have been created or already exist."
