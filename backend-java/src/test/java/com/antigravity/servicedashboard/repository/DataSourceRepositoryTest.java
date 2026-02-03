package com.antigravity.servicedashboard.repository;

import com.antigravity.servicedashboard.entity.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
@TestPropertySource(locations = "classpath:application-test.properties")
public class DataSourceRepositoryTest {

    @Autowired
    private DataSourceRepository dataSourceRepository;

    @Test
    public void testSaveAndFindById() {
        DataSource ds = new DataSource();
        ds.setName("Test Source");
        ds.setType("REST_API");
        ds.setConfig("{\"url\":\"http://test\"}");

        DataSource saved = dataSourceRepository.save(ds);
        assertNotNull(saved.getId());

        Optional<DataSource> found = dataSourceRepository.findById(saved.getId());
        assertTrue(found.isPresent());
        assertEquals("Test Source", found.get().getName());
    }

    @Test
    public void testDelete() {
        DataSource ds = new DataSource();
        ds.setName("To Delete");
        ds.setType("DB");
        ds.setConfig("{}");
        DataSource saved = dataSourceRepository.save(ds);

        dataSourceRepository.deleteById(saved.getId());
        Optional<DataSource> found = dataSourceRepository.findById(saved.getId());
        assertFalse(found.isPresent());
    }
}
