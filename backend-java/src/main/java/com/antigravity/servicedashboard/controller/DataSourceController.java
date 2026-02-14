package com.antigravity.servicedashboard.controller;

import com.antigravity.servicedashboard.entity.DataSource;
import com.antigravity.servicedashboard.service.DataSourceService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/data-sources")
public class DataSourceController {

    private final DataSourceService service;

    public DataSourceController(DataSourceService service) {
        this.service = service;
    }

    @GetMapping
    public List<DataSource> getAll() {
        return service.getAll();
    }

    @PostMapping
    public DataSource create(@Valid @RequestBody DataSource entity) {
        return service.create(entity);
    }

    @PutMapping("/{id}")
    public ResponseEntity<DataSource> update(@PathVariable Long id, @Valid @RequestBody DataSource entity) {
        return service.update(id, entity)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (service.delete(id)) {
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
    }
}
