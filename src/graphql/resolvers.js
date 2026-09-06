const encodeCursor = (id) => Buffer.from(id).toString('base64');
const decodeCursor = (cursor) => Buffer.from(cursor, 'base64').toString('utf-8');

const mockConfigs = [
  {
    id: '1',
    name: 'Production Config',
    version: '1.0.0',
    createdAt: new Date('2026-01-01').toISOString(),
    updatedAt: new Date('2026-08-15').toISOString(),
    metadata: {
      owner: 'api-platform-team',
      environment: 'production',
      tags: ['critical', 'managed']
    }
  },
  {
    id: '2',
    name: 'Staging Config',
    version: '1.0.0',
    createdAt: new Date('2026-01-05').toISOString(),
    updatedAt: new Date('2026-08-14').toISOString(),
    metadata: {
      owner: 'api-platform-team',
      environment: 'staging',
      tags: ['managed']
    }
  },
  {
    id: '3',
    name: 'Development Config',
    version: '1.0.0',
    createdAt: new Date('2026-01-10').toISOString(),
    updatedAt: new Date('2026-08-10').toISOString(),
    metadata: {
      owner: 'api-platform-team',
      environment: 'development',
      tags: ['development']
    }
  }
];

const resolvers = {
  Query: {
    health: () => 'ok',

    config: (_, { id }) => {
      const config = mockConfigs.find(c => c.id === id);
      if (!config) {
        throw new Error(`Config not found: ${id}`, {
          extensions: {
            code: 'CONFIG_NOT_FOUND',
            configId: id
          }
        });
      }
      return config;
    },

    configs: (_, { after, first = 10, before, last }) => {
      let allConfigs = [...mockConfigs];
      let startIndex = 0;
      let endIndex = allConfigs.length;

      if (after) {
        const afterIndex = parseInt(decodeCursor(after));
        startIndex = afterIndex + 1;
      }

      if (before) {
        const beforeIndex = parseInt(decodeCursor(before));
        endIndex = beforeIndex;
      }

      allConfigs = allConfigs.slice(startIndex, endIndex);

      let paginatedConfigs = allConfigs;
      if (first) {
        paginatedConfigs = allConfigs.slice(0, first);
      } else if (last) {
        paginatedConfigs = allConfigs.slice(-last);
      }

      const edges = paginatedConfigs.map((config, idx) => ({
        node: config,
        cursor: encodeCursor((startIndex + idx).toString())
      }));

      const pageInfo = {
        hasNextPage: startIndex + paginatedConfigs.length < endIndex,
        hasPreviousPage: startIndex > 0,
        startCursor: edges.length > 0 ? edges[0].cursor : null,
        endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null
      };

      return {
        edges,
        pageInfo,
        totalCount: mockConfigs.length
      };
    }
  },

  Mutation: {
    createConfig: (_, { input }, { user }) => {
      if (!user) {
        throw new Error('Unauthorized', {
          extensions: {
            code: 'UNAUTHENTICATED'
          }
        });
      }

      const newId = (Math.max(...mockConfigs.map(c => parseInt(c.id))) + 1).toString();
      const now = new Date().toISOString();

      const newConfig = {
        id: newId,
        name: input.name,
        version: input.version,
        createdAt: now,
        updatedAt: now,
        metadata: input.metadata || {
          owner: user.id,
          environment: 'development',
          tags: []
        }
      };

      mockConfigs.push(newConfig);
      return newConfig;
    },

    updateConfig: (_, { id, input }, { user }) => {
      if (!user) {
        throw new Error('Unauthorized', {
          extensions: {
            code: 'UNAUTHENTICATED'
          }
        });
      }

      const config = mockConfigs.find(c => c.id === id);
      if (!config) {
        throw new Error(`Config not found: ${id}`, {
          extensions: {
            code: 'CONFIG_NOT_FOUND',
            configId: id
          }
        });
      }

      if (input.name) config.name = input.name;
      if (input.version) config.version = input.version;
      if (input.metadata) config.metadata = input.metadata;
      config.updatedAt = new Date().toISOString();

      return config;
    },

    deleteConfig: (_, { id }, { user }) => {
      if (!user) {
        throw new Error('Unauthorized', {
          extensions: {
            code: 'UNAUTHENTICATED'
          }
        });
      }

      const index = mockConfigs.findIndex(c => c.id === id);
      if (index === -1) {
        throw new Error(`Config not found: ${id}`, {
          extensions: {
            code: 'CONFIG_NOT_FOUND',
            configId: id
          }
        });
      }

      mockConfigs.splice(index, 1);
      return true;
    }
  }
};

module.exports = resolvers;
