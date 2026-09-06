const { gql } = require('@apollo/server');

const typeDefs = gql`
  directive @rateLimit(
    limit: Int!
    window: String!
  ) on FIELD_DEFINITION

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  type Query {
    health: String!
    config(id: String!): Config
    configs(after: String, first: Int = 10, before: String, last: Int): ConfigConnection!
  }

  type Mutation {
    createConfig(input: CreateConfigInput!): Config!
    updateConfig(id: String!, input: UpdateConfigInput!): Config!
    deleteConfig(id: String!): Boolean!
  }

  type Config {
    id: String!
    name: String!
    version: String!
    createdAt: String!
    updatedAt: String!
    metadata: ConfigMetadata
  }

  type ConfigMetadata {
    owner: String
    environment: String
    tags: [String!]!
  }

  type ConfigEdge {
    node: Config!
    cursor: String!
  }

  type ConfigConnection {
    edges: [ConfigEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  input CreateConfigInput {
    name: String!
    version: String!
    metadata: ConfigMetadataInput
  }

  input UpdateConfigInput {
    name: String
    version: String
    metadata: ConfigMetadataInput
  }

  input ConfigMetadataInput {
    owner: String
    environment: String
    tags: [String!]
  }

  enum ConfigStatus {
    ACTIVE
    DEPRECATED
    ARCHIVED
  }

  type Error {
    code: String!
    message: String!
    details: String
  }
`;

module.exports = typeDefs;
