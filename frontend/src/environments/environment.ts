export const environment = {
    production: false,
    apiUrl: 'http://localhost:8080/api',
    menus: {
        dashboard: true,
        formBuilder: false,
        automation: true,
        kubernetes: false,
        policyVisualizer: true,
        policyComparison: true,
        naturalLanguage: false,
        administration: {
            dataSources: true,
            syncJobs: true,
            widgets: true,
            notificationRules: true,
            users: true,
            certificates: false
        }
    }
};
