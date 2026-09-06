#!/usr/bin/env node

const { buildSchema } = require('graphql');
const typeDefs = require('./schema');

const validateSchema = () => {
  try {
    const schemaString = typeof typeDefs === 'object' 
      ? typeDefs.loc.source.body 
      : typeDefs;
    
    const schema = buildSchema(schemaString);
    console.log('✓ Schema is valid');
    console.log(`✓ Schema contains ${Object.keys(schema.getTypeMap()).length} types`);
    
    const queryType = schema.getQueryType();
    const mutationType = schema.getMutationType();
    
    if (queryType) {
      const queryFields = Object.keys(queryType.getFields());
      console.log(`✓ Query type has ${queryFields.length} fields: ${queryFields.join(', ')}`);
    }
    
    if (mutationType) {
      const mutationFields = Object.keys(mutationType.getFields());
      console.log(`✓ Mutation type has ${mutationFields.length} fields: ${mutationFields.join(', ')}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Schema validation failed:');
    console.error(error.message);
    process.exit(1);
  }
};

validateSchema();
