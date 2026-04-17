package com.antigravity.servicedashboard.k8s;

import com.antigravity.servicedashboard.entity.AppConfig;
import com.antigravity.servicedashboard.repository.AppConfigRepository;
import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.Configuration;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.models.V1Pod;
import io.kubernetes.client.openapi.models.V1PodList;
import io.kubernetes.client.util.ClientBuilder;
import io.kubernetes.client.util.KubeConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.FileReader;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;

@Service
public class K8sService {

    private static final Logger logger = LoggerFactory.getLogger(K8sService.class);
    private final AppConfigRepository appConfigRepository;

    private ApiClient client;
    private CoreV1Api api;

    public K8sService(AppConfigRepository appConfigRepository) {
        this.appConfigRepository = appConfigRepository;
    }


    public synchronized boolean connect() {
        try {
            String type = getConfigValue("k8s_config_type");
            String value = getConfigValue("k8s_config_value");

            if (type == null || value == null) {
                logger.warn("K8s config missing");
                return false;
            }

            if ("FILE".equalsIgnoreCase(type)) {

                client = ClientBuilder.kubeconfig(KubeConfig.loadKubeConfig(new FileReader(value))).build();
            } else if ("TOKEN".equalsIgnoreCase(type)) {

                client = ClientBuilder.kubeconfig(KubeConfig.loadKubeConfig(new StringReader(value))).build();
            } else {
                return false;
            }

            Configuration.setDefaultApiClient(client);
            api = new CoreV1Api(client);
            logger.info("Connected to K8s Cluster");
            return true;
        } catch (Exception e) {
            logger.error("Failed to connect to K8s", e);
            return false;
        }
    }

    public void saveConfig(String type, String value) {
        saveConfigValue("k8s_config_type", type);
        saveConfigValue("k8s_config_value", value);
        connect();
    }

    public List<K8sPodDto> listPods(String namespace) {
        List<K8sPodDto> dtos = new ArrayList<>();
        if (api == null && !connect()) {
            return dtos;
        }

        try {

            String ns = (namespace == null || namespace.isEmpty()) ? "" : namespace;

            V1PodList list;
            if (ns.isEmpty()) {
                list = api.listPodForAllNamespaces(null, null, null, null, null, null, null, null, null, null, null);
            } else {
                list = api.listNamespacedPod(ns, null, null, null, null, null, null, null, null, null, null, null);
            }

            for (V1Pod pod : list.getItems()) {
                K8sPodDto dto = new K8sPodDto();
                dto.setName(pod.getMetadata().getName());
                dto.setNamespace(pod.getMetadata().getNamespace());
                dto.setStatus(pod.getStatus().getPhase());
                dto.setIp(pod.getStatus().getPodIP());
                dto.setNode(pod.getSpec().getNodeName());
                dtos.add(dto);
            }
        } catch (

        Exception e) {
            logger.error("Error listing pods", e);
        }
        return dtos;
    }

    public ApiClient getClient() {
        if (client == null)
            connect();
        return client;
    }

    private String getConfigValue(String key) {
        return appConfigRepository.findById(key).map(AppConfig::getValue).orElse(null);
    }

    private void saveConfigValue(String key, String value) {
        AppConfig config = new AppConfig();
        config.setKey(key);
        config.setValue(value);
        appConfigRepository.save(config);
    }
}
