package com.antigravity.servicedashboard.k8s;

import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/k8s")
public class K8sController {

    private final K8sService service;

    public K8sController(K8sService service) {
        this.service = service;
    }

    @PostMapping("/config")
    public void saveConfig(@RequestBody Map<String, String> payload) {
        String type = payload.get("type");
        String value = payload.get("value");
        service.saveConfig(type, value);
    }

    @GetMapping("/pods")
    public List<K8sPodDto> listPods(@RequestParam(required = false) String namespace) {
        return service.listPods(namespace);
    }
}
