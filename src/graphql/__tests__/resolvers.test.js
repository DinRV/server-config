const { ApolloServer } = require('@apollo/server');
const typeDefs = require('../schema');
const resolvers = require('../resolvers');

describe('GraphQL Resolvers', () => {
  let server;

  beforeAll(async () => {
    server = new ApolloServer({
      typeDefs,
      resolvers,
      introspection: true,
    });
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  describe('Query', () => {
    it('should return health status', async () => {
      const result = await server.executeOperation({
        query: `query { health }`,
      });

      expect(result.body.kind).toBe('single');
      expect(result.body.singleResult.data).toEqual({ health: 'ok' });
    });

    it('should fetch a single config by id', async () => {
      const result = await server.executeOperation({
        query: `query GetConfig($id: String!) {
          config(id: $id) {
            id
            name
            version
          }
        }`,
        variables: { id: '1' },
      });

      expect(result.body.kind).toBe('single');
      expect(result.body.singleResult.data.config).toMatchObject({
        id: '1',
        name: 'Production Config',
        version: '1.0.0',
      });
    });

    it('should return error for non-existent config', async () => {
      const result = await server.executeOperation({
        query: `query GetConfig($id: String!) {
          config(id: $id) {
            id
          }
        }`,
        variables: { id: 'non-existent' },
      });

      expect(result.body.kind).toBe('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].extensions.code).toBe('CONFIG_NOT_FOUND');
    });

    it('should list configs with cursor pagination', async () => {
      const result = await server.executeOperation({
        query: `query ListConfigs($first: Int) {
          configs(first: $first) {
            edges {
              node {
                id
                name
              }
              cursor
            }
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
            totalCount
          }
        }`,
        variables: { first: 2 },
      });

      expect(result.body.kind).toBe('single');
      const data = result.body.singleResult.data.configs;
      expect(data.edges).toHaveLength(2);
      expect(data.pageInfo.hasNextPage).toBe(true);
      expect(data.pageInfo.hasPreviousPage).toBe(false);
      expect(data.totalCount).toBe(3);
    });
  });

  describe('Mutation', () => {
    it('should create a new config', async () => {
      const result = await server.executeOperation(
        {
          query: `mutation CreateConfig($input: CreateConfigInput!) {
            createConfig(input: $input) {
              id
              name
              version
              createdAt
            }
          }`,
          variables: {
            input: {
              name: 'Test Config',
              version: '1.0.0',
            },
          },
        },
        {
          contextValue: {
            user: { id: 'test-user' },
          },
        }
      );

      expect(result.body.kind).toBe('single');
      expect(result.body.singleResult.data.createConfig).toMatchObject({
        name: 'Test Config',
        version: '1.0.0',
      });
    });

    it('should require authentication for mutations', async () => {
      const result = await server.executeOperation(
        {
          query: `mutation CreateConfig($input: CreateConfigInput!) {
            createConfig(input: $input) {
              id
              name
            }
          }`,
          variables: {
            input: {
              name: 'Test Config',
              version: '1.0.0',
            },
          },
        },
        {
          contextValue: {
            user: null,
          },
        }
      );

      expect(result.body.kind).toBe('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].extensions.code).toBe('UNAUTHENTICATED');
    });

    it('should update an existing config', async () => {
      const result = await server.executeOperation(
        {
          query: `mutation UpdateConfig($id: String!, $input: UpdateConfigInput!) {
            updateConfig(id: $id, input: $input) {
              id
              name
              updatedAt
            }
          }`,
          variables: {
            id: '1',
            input: { name: 'Updated Production Config' },
          },
        },
        {
          contextValue: {
            user: { id: 'test-user' },
          },
        }
      );

      expect(result.body.kind).toBe('single');
      expect(result.body.singleResult.data.updateConfig.name).toBe('Updated Production Config');
    });

    it('should delete a config', async () => {
      const result = await server.executeOperation(
        {
          query: `mutation DeleteConfig($id: String!) {
            deleteConfig(id: $id)
          }`,
          variables: { id: '3' },
        },
        {
          contextValue: {
            user: { id: 'test-user' },
          },
        }
      );

      expect(result.body.kind).toBe('single');
      expect(result.body.singleResult.data.deleteConfig).toBe(true);
    });
  });
});
