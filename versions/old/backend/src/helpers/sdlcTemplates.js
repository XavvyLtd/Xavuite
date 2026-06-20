export function generateSprintTasks(sprint) {

  const sprintName =
    sprint.sprint_name || '';

  const sprintDesc =
    sprint.description || '';

  const combined =
    `${sprintName} ${sprintDesc}`.toLowerCase();

  let domain = 'general';

  if (
    combined.includes('jwt') ||
    combined.includes('security') ||
    combined.includes('auth')
  ) {
    domain = 'security';
  }

  else if (
    combined.includes('telemetry') ||
    combined.includes('iot') ||
    combined.includes('mqtt') ||
    combined.includes('payload')
  ) {
    domain = 'iot';
  }

  else if (
    combined.includes('dashboard') ||
    combined.includes('analytics') ||
    combined.includes('visual')
  ) {
    domain = 'analytics';
  }

  else if (
    combined.includes('rtls') ||
    combined.includes('zone') ||
    combined.includes('tracking')
  ) {
    domain = 'rtls';
  }

  else if (
    combined.includes('worker') ||
    combined.includes('cloudflare') ||
    combined.includes('edge')
  ) {
    domain = 'edge';
  }

  const templates = {

    security: [
      {
        employeeId: 2,
        category: 'Requirements',
        order: 1,
        phase: 'Requirements',
        task:
          `Define operational authentication abuse scenarios and secure access audit requirements for ${sprintName}`
      },

      {
        employeeId: 3,
        category: 'Database',
        order: 2,
        phase: 'Architecture',
        task:
          `Design encrypted token persistence and relational audit tracking structures for ${sprintName}`
      },

      {
        employeeId: 4,
        category: 'Backend',
        order: 3,
        phase: 'Development',
        task:
          `Implement Cloudflare Worker JWT validation middleware and secure authentication flows for ${sprintName}`
      },

      {
        employeeId: 5,
        category: 'Frontend',
        order: 4,
        phase: 'Development',
        task:
          `Build frontend session lifecycle handling and token expiration UX flows for ${sprintName}`
      },

      {
        employeeId: 2,
        category: 'QA',
        order: 5,
        phase: 'Testing',
        task:
          `Execute authentication replay simulation and penetration QA testing for ${sprintName}`
      }
    ],

    iot: [
      {
        employeeId: 2,
        category: 'Requirements',
        order: 1,
        phase: 'Requirements',
        task:
          `Define IoT telemetry validation workflows and warehouse event processing requirements for ${sprintName}`
      },

      {
        employeeId: 3,
        category: 'Database',
        order: 2,
        phase: 'Architecture',
        task:
          `Design telemetry payload persistence and relational event indexing strategies for ${sprintName}`
      },

      {
        employeeId: 4,
        category: 'Backend',
        order: 3,
        phase: 'Development',
        task:
          `Implement edge telemetry ingestion workers and RTLS event processing APIs for ${sprintName}`
      },

      {
        employeeId: 5,
        category: 'Frontend',
        order: 4,
        phase: 'Development',
        task:
          `Build real-time operational telemetry dashboards and manufacturing monitoring widgets for ${sprintName}`
      },

      {
        employeeId: 2,
        category: 'QA',
        order: 5,
        phase: 'Testing',
        task:
          `Execute warehouse telemetry replay validation and RTLS simulation testing for ${sprintName}`
      }
    ],

    analytics: [
      {
        employeeId: 2,
        category: 'Requirements',
        order: 1,
        phase: 'Requirements',
        task:
          `Define operational analytics KPIs and executive reporting requirements for ${sprintName}`
      },

      {
        employeeId: 3,
        category: 'Database',
        order: 2,
        phase: 'Architecture',
        task:
          `Design aggregation pipelines and relational analytics query optimization for ${sprintName}`
      },

      {
        employeeId: 4,
        category: 'Backend',
        order: 3,
        phase: 'Development',
        task:
          `Implement analytics aggregation services and telemetry processing APIs for ${sprintName}`
      },

      {
        employeeId: 5,
        category: 'Frontend',
        order: 4,
        phase: 'Development',
        task:
          `Build executive dashboards and real-time operational analytics visualization workflows for ${sprintName}`
      },

      {
        employeeId: 2,
        category: 'QA',
        order: 5,
        phase: 'Testing',
        task:
          `Execute analytics validation and operational reporting QA verification for ${sprintName}`
      }
    ],

    rtls: [
      {
        employeeId: 2,
        category: 'Requirements',
        order: 1,
        phase: 'Requirements',
        task:
          `Define RTLS asset tracking workflows and operational zone monitoring requirements for ${sprintName}`
      },

      {
        employeeId: 3,
        category: 'Database',
        order: 2,
        phase: 'Architecture',
        task:
          `Design positional telemetry storage and RTLS zone event relational indexing for ${sprintName}`
      },

      {
        employeeId: 4,
        category: 'Backend',
        order: 3,
        phase: 'Development',
        task:
          `Implement RTLS positioning ingestion APIs and zone transition processing services for ${sprintName}`
      },

      {
        employeeId: 5,
        category: 'Frontend',
        order: 4,
        phase: 'Development',
        task:
          `Build live RTLS visualization dashboards and operational floor tracking interfaces for ${sprintName}`
      },

      {
        employeeId: 2,
        category: 'QA',
        order: 5,
        phase: 'Testing',
        task:
          `Execute RTLS movement replay simulation and positioning accuracy validation for ${sprintName}`
      }
    ],

    edge: [
      {
        employeeId: 2,
        category: 'Requirements',
        order: 1,
        phase: 'Requirements',
        task:
          `Define distributed edge processing workflows and operational failover requirements for ${sprintName}`
      },

      {
        employeeId: 3,
        category: 'Database',
        order: 2,
        phase: 'Architecture',
        task:
          `Design edge persistence synchronization and distributed data consistency models for ${sprintName}`
      },

      {
        employeeId: 4,
        category: 'Backend',
        order: 3,
        phase: 'Development',
        task:
          `Implement Cloudflare edge workers and distributed processing orchestration for ${sprintName}`
      },

      {
        employeeId: 5,
        category: 'Frontend',
        order: 4,
        phase: 'Development',
        task:
          `Build edge operational monitoring interfaces and distributed telemetry visualization dashboards for ${sprintName}`
      },

      {
        employeeId: 2,
        category: 'QA',
        order: 5,
        phase: 'Testing',
        task:
          `Execute distributed failover validation and edge resilience simulation testing for ${sprintName}`
      }
    ]
  };

  return templates[domain] || templates.iot;
}