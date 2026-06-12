package com.antigravity.servicedashboard.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.TestPropertySource;

import com.antigravity.servicedashboard.entity.WidgetDefinition;

@DataJpaTest
@TestPropertySource(locations = "classpath:application-test.properties")
public class WidgetDefinitionRepositoryTest {

    @Autowired
    private WidgetDefinitionRepository widgetRepository;

    @Test
    public void testSaveAndRetrieve() {
        WidgetDefinition widget = new WidgetDefinition();
        widget.setTitle("My Widget");
        widget.setType("CARD");
        widget.setDataSourceTable("data_table");

        WidgetDefinition saved = widgetRepository.save(widget);
        assertNotNull(saved.getId());

        Optional<WidgetDefinition> found = widgetRepository.findById(saved.getId());
        assertTrue(found.isPresent());
        assertEquals("My Widget", found.get().getTitle());
    }
}
